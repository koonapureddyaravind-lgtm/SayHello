package com.omniflow.crm.service;

import com.omniflow.common.exception.BadRequestException;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.BufferedInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.PushbackInputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Comparator;
import java.util.UUID;
import java.util.stream.Stream;

/**
 * Local, stream-oriented staging area for chunked CSV uploads.
 *
 * <p>Files are never loaded into memory. The API writes upload parts, then the
 * worker stitches them into a single CSV and streams it row by row. The Docker
 * deployment mounts this directory on a shared named volume so uploads survive
 * API and worker restarts.</p>
 */
@Component
public class ContactImportStorage {

    private static final Logger log = LoggerFactory.getLogger(ContactImportStorage.class);
    private static final int COPY_BUFFER = 64 * 1024;
    private static final int HEADER_PEEK_BYTES = 1024 * 1024;
    private static final String UPLOAD_FILE = "upload.csv";
    private static final String PARTS_DIR = "parts";

    private final Path root;
    private final long maxChunkBytes;

    public ContactImportStorage(
            @Value("${omniflow.import.staging-dir:./data/imports}") String stagingDir,
            @Value("${omniflow.import.max-chunk-bytes:33554432}") long maxChunkBytes) {
        this.root = Path.of(stagingDir).toAbsolutePath().normalize();
        this.maxChunkBytes = maxChunkBytes;
    }

    @PostConstruct
    void init() {
        try {
            Files.createDirectories(root);
            log.info("Contact import staging directory: {}", root);
        } catch (IOException ex) {
            throw new IllegalStateException("Unable to create contact import staging directory " + root, ex);
        }
    }

    public void initialize(UUID organizationId, UUID importId) {
        try {
            Files.createDirectories(partsDir(organizationId, importId));
        } catch (IOException ex) {
            throw new IllegalStateException("Unable to initialise import storage", ex);
        }
    }

    public Path jobDir(UUID organizationId, UUID importId) {
        return root.resolve(organizationId.toString()).resolve(importId.toString());
    }

    public Path uploadPath(UUID organizationId, UUID importId) {
        return jobDir(organizationId, importId).resolve(UPLOAD_FILE);
    }

    public Path partsDir(UUID organizationId, UUID importId) {
        return jobDir(organizationId, importId).resolve(PARTS_DIR);
    }

    public Path partPath(UUID organizationId, UUID importId, int index) {
        return partsDir(organizationId, importId).resolve(index + ".part");
    }

    public boolean partExists(UUID organizationId, UUID importId, int index) {
        return Files.isRegularFile(partPath(organizationId, importId, index));
    }

    public boolean hasAllParts(UUID organizationId, UUID importId, int totalChunks) {
        for (int index = 0; index < totalChunks; index++) {
            if (!partExists(organizationId, importId, index)) {
                return false;
            }
        }
        return true;
    }

    /**
     * Streams one chunk to a temporary file. The caller holds no DB lock while
     * bytes are written, then calls {@link #commitPart} under the job row lock.
     */
    public StagedPart stagePart(UUID organizationId, UUID importId, int index, InputStream input) {
        Path target = partPath(organizationId, importId, index);
        Path temp = target.resolveSibling(index + "-" + UUID.randomUUID() + ".tmp");
        long written = 0;
        try {
            Files.createDirectories(temp.getParent());
            try (OutputStream output = Files.newOutputStream(temp)) {
                byte[] buffer = new byte[COPY_BUFFER];
                int read;
                while ((read = input.read(buffer)) != -1) {
                    written += read;
                    if (written > maxChunkBytes) {
                        throw new BadRequestException("IMPORT_CHUNK_TOO_LARGE",
                                "Upload chunks must be smaller than " + maxChunkBytes + " bytes");
                    }
                    output.write(buffer, 0, read);
                }
            }
            return new StagedPart(temp, written);
        } catch (BadRequestException ex) {
            deleteQuietly(temp);
            throw ex;
        } catch (IOException ex) {
            deleteQuietly(temp);
            throw new BadRequestException("IMPORT_CHUNK_FAILED", "Unable to store the uploaded chunk");
        }
    }

    public void discard(StagedPart staged) {
        if (staged != null) {
            deleteQuietly(staged.tempPath());
        }
    }

    public PartCommit commitPart(UUID organizationId, UUID importId, int index, StagedPart staged) {
        Path target = partPath(organizationId, importId, index);
        try {
            long previousSize = Files.isRegularFile(target) ? Files.size(target) : 0;
            boolean existed = Files.isRegularFile(target);
            Files.createDirectories(target.getParent());
            Files.move(staged.tempPath(), target, StandardCopyOption.REPLACE_EXISTING);
            return new PartCommit(existed, previousSize, staged.sizeBytes());
        } catch (IOException ex) {
            deleteQuietly(staged.tempPath());
            throw new BadRequestException("IMPORT_CHUNK_FAILED", "Unable to finalise the uploaded chunk");
        }
    }

    /**
     * Reads a bounded prefix of the first chunk so the API can validate and
     * auto-detect the header without assembling the whole file.
     */
    public byte[] readHeaderPrefix(UUID organizationId, UUID importId) {
        Path first = partPath(organizationId, importId, 0);
        if (!Files.isRegularFile(first)) {
            first = uploadPath(organizationId, importId);
        }
        if (!Files.isRegularFile(first)) {
            return new byte[0];
        }
        try (InputStream input = new BufferedInputStream(Files.newInputStream(first))) {
            return input.readNBytes(HEADER_PEEK_BYTES);
        } catch (IOException ex) {
            throw new BadRequestException("IMPORT_HEADER_FAILED", "Unable to read the CSV header");
        }
    }

    /**
     * Stitches upload parts into a single CSV, counting newlines on the fly for
     * a cheap progress estimate. Safe to call repeatedly: the finished file is
     * reused if a previous worker attempt already assembled it.
     */
    public AssemblyResult assembleIfNeeded(UUID organizationId, UUID importId, int totalChunks) {
        Path upload = uploadPath(organizationId, importId);
        try {
            if (Files.isRegularFile(upload)) {
                return new AssemblyResult(Files.size(upload), 0, false);
            }
            Path temp = upload.resolveSibling(UPLOAD_FILE + "-" + UUID.randomUUID() + ".tmp");
            long bytes = 0;
            long newlines = 0;
            try (OutputStream output = Files.newOutputStream(temp)) {
                byte[] buffer = new byte[COPY_BUFFER];
                for (int index = 0; index < totalChunks; index++) {
                    Path part = partPath(organizationId, importId, index);
                    if (!Files.isRegularFile(part)) {
                        throw new IllegalStateException("Upload part " + index + " is missing");
                    }
                    try (InputStream raw = Files.newInputStream(part)) {
                        InputStream input = index == 0 ? skipBom(raw) : raw;
                        int read;
                        while ((read = input.read(buffer)) != -1) {
                            for (int i = 0; i < read; i++) {
                                if (buffer[i] == '\n') {
                                    newlines++;
                                }
                            }
                            output.write(buffer, 0, read);
                            bytes += read;
                        }
                    }
                }
            }
            Files.move(temp, upload, StandardCopyOption.REPLACE_EXISTING);
            deleteParts(organizationId, importId);
            return new AssemblyResult(bytes, newlines, true);
        } catch (IllegalStateException ex) {
            throw ex;
        } catch (IOException ex) {
            throw new IllegalStateException("Unable to assemble the uploaded CSV", ex);
        }
    }

    public void deleteUpload(UUID organizationId, UUID importId) {
        deleteQuietly(uploadPath(organizationId, importId));
    }

    public void deleteParts(UUID organizationId, UUID importId) {
        deleteRecursively(partsDir(organizationId, importId));
    }

    public void deleteJob(UUID organizationId, UUID importId) {
        deleteRecursively(jobDir(organizationId, importId));
    }

    private InputStream skipBom(InputStream input) throws IOException {
        PushbackInputStream pushback = new PushbackInputStream(input, 3);
        byte[] header = new byte[3];
        int read = pushback.read(header, 0, 3);
        if (read == 3 && (header[0] & 0xFF) == 0xEF && (header[1] & 0xFF) == 0xBB
                && (header[2] & 0xFF) == 0xBF) {
            return pushback;
        }
        if (read > 0) {
            pushback.unread(header, 0, read);
        }
        return pushback;
    }

    private void deleteRecursively(Path path) {
        if (!Files.exists(path)) {
            return;
        }
        try (Stream<Path> walk = Files.walk(path)) {
            walk.sorted(Comparator.reverseOrder()).forEach(this::deleteQuietly);
        } catch (IOException ex) {
            log.warn("Unable to delete import staging path {}: {}", path, ex.getMessage());
        }
    }

    private void deleteQuietly(Path path) {
        try {
            Files.deleteIfExists(path);
        } catch (IOException ex) {
            log.warn("Unable to delete {}: {}", path, ex.getMessage());
        }
    }

    public record StagedPart(Path tempPath, long sizeBytes) {
    }

    public record PartCommit(boolean existed, long previousSizeBytes, long sizeBytes) {
    }

    public record AssemblyResult(long sizeBytes, long newlineCount, boolean assembled) {
    }
}
