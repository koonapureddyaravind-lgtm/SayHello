package com.omniflow.crm.service;

import java.io.Closeable;
import java.io.IOException;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/**
 * Streaming RFC 4180 CSV reader that keeps an exact character offset.
 *
 * <p>The offset is advanced only after a complete record has been consumed, so a
 * crashed worker can reopen the file at {@code offset} and continue without
 * re-parsing or re-applying the rows that were already committed. Apache
 * Commons CSV does not expose record boundaries, which is why this small reader
 * exists.</p>
 */
final class ContactImportCsvReader implements Closeable {

    private final Reader reader;
    private final char delimiter;
    private long offset;
    private int pushed = -1;
    private boolean eof;

    ContactImportCsvReader(Path file, char delimiter, long startOffset) throws IOException {
        this.reader = Files.newBufferedReader(file, StandardCharsets.UTF_8);
        this.delimiter = delimiter <= 0 ? ',' : delimiter;
        skip(startOffset);
    }

    long offset() {
        return offset;
    }

    /**
     * @return the next record, or {@code null} at end of file. A completely empty
     *         line is returned as a single empty field and should be ignored by
     *         the caller.
     */
    List<String> next() throws IOException {
        if (eof) {
            return null;
        }
        List<String> fields = new ArrayList<>();
        StringBuilder field = new StringBuilder();
        boolean quoted = false;
        boolean sawAny = false;

        while (true) {
            int c = read();
            if (c == -1) {
                eof = true;
                if (!sawAny && fields.isEmpty() && field.length() == 0) {
                    return null;
                }
                fields.add(field.toString());
                return fields;
            }
            if (c == '\uFEFF' && fields.isEmpty() && field.length() == 0 && offset <= 1) {
                continue;
            }
            if (quoted) {
                if (c == '"') {
                    int next = read();
                    if (next == '"') {
                        field.append('"');
                    } else {
                        quoted = false;
                        if (next != -1) {
                            unread(next);
                        } else {
                            eof = true;
                            fields.add(field.toString());
                            return fields;
                        }
                    }
                } else {
                    field.append((char) c);
                }
                sawAny = true;
                continue;
            }

            if (c == '"' && field.length() == 0) {
                quoted = true;
                sawAny = true;
            } else if (c == delimiter) {
                fields.add(field.toString());
                field.setLength(0);
                sawAny = true;
            } else if (c == '\n') {
                fields.add(field.toString());
                return fields;
            } else if (c == '\r') {
                int next = read();
                if (next != '\n' && next != -1) {
                    unread(next);
                } else if (next == -1) {
                    eof = true;
                }
                fields.add(field.toString());
                return fields;
            } else {
                field.append((char) c);
                sawAny = true;
            }
        }
    }

    private int read() throws IOException {
        if (pushed != -1) {
            int value = pushed;
            pushed = -1;
            offset++;
            return value;
        }
        int value = reader.read();
        if (value != -1) {
            offset++;
        }
        return value;
    }

    private void unread(int value) {
        pushed = value;
        offset--;
    }

    private void skip(long characters) throws IOException {
        long remaining = Math.max(0, characters);
        char[] buffer = new char[8192];
        while (remaining > 0) {
            int read = reader.read(buffer, 0, (int) Math.min(buffer.length, remaining));
            if (read == -1) {
                eof = true;
                break;
            }
            offset += read;
            remaining -= read;
        }
    }

    @Override
    public void close() throws IOException {
        reader.close();
    }
}
