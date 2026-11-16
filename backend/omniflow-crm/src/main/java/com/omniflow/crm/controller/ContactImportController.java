package com.omniflow.crm.controller;

import com.omniflow.common.api.ApiResponse;
import com.omniflow.common.api.PageQuery;
import com.omniflow.common.api.PageResponse;
import com.omniflow.common.tenant.TenantGuard;
import com.omniflow.crm.dto.CompleteContactImportRequest;
import com.omniflow.crm.dto.ContactImportErrorView;
import com.omniflow.crm.dto.ContactImportView;
import com.omniflow.crm.dto.CreateContactImportRequest;
import com.omniflow.crm.service.ContactImportService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

/**
 * Chunked import API. The synchronous /contacts/import endpoint remains for
 * small files; this one is built for uploads that never fit in memory.
 */
@RestController
@RequestMapping("/api/v1/contacts/imports")
@RequiredArgsConstructor
public class ContactImportController {

    private final ContactImportService importService;
    private final TenantGuard tenantGuard;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ContactImportView> create(
            @Valid @RequestBody CreateContactImportRequest request) {
        return ApiResponse.ok(importService.create(
                tenantGuard.currentOrganizationId(), tenantGuard.currentUserIdOrNull(), request));
    }

    @GetMapping
    public ApiResponse<PageResponse<ContactImportView>> list(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return ApiResponse.ok(importService.list(
                tenantGuard.currentOrganizationId(), PageQuery.of(page, size)));
    }

    @GetMapping("/{id}")
    public ApiResponse<ContactImportView> get(@PathVariable UUID id) {
        return ApiResponse.ok(importService.get(tenantGuard.currentOrganizationId(), id));
    }

    @PostMapping(value = "/{id}/chunks/{index}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<ContactImportView> uploadChunk(@PathVariable UUID id,
                                                      @PathVariable int index,
                                                      @RequestParam("chunk") MultipartFile chunk) {
        return ApiResponse.ok(importService.uploadChunk(
                tenantGuard.currentOrganizationId(), id, index, chunk));
    }

    @PostMapping("/{id}/complete")
    public ApiResponse<ContactImportView> complete(
            @PathVariable UUID id,
            @RequestBody(required = false) CompleteContactImportRequest request) {
        return ApiResponse.ok(importService.complete(
                tenantGuard.currentOrganizationId(), id, request));
    }

    @PostMapping("/{id}/cancel")
    public ApiResponse<ContactImportView> cancel(@PathVariable UUID id) {
        return ApiResponse.ok(importService.cancel(tenantGuard.currentOrganizationId(), id));
    }

    @PostMapping("/{id}/retry")
    public ApiResponse<ContactImportView> retry(@PathVariable UUID id) {
        return ApiResponse.ok(importService.retry(tenantGuard.currentOrganizationId(), id));
    }

    @GetMapping("/{id}/errors")
    public ApiResponse<PageResponse<ContactImportErrorView>> errors(
            @PathVariable UUID id,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return ApiResponse.ok(importService.errors(
                tenantGuard.currentOrganizationId(), id, PageQuery.of(page, size)));
    }

    @GetMapping(value = "/{id}/errors.csv", produces = "text/csv")
    public ResponseEntity<byte[]> errorsCsv(@PathVariable UUID id) {
        String csv = importService.errorsCsv(tenantGuard.currentOrganizationId(), id);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"import-errors-" + id + ".csv\"")
                .contentType(MediaType.parseMediaType("text/csv;charset=UTF-8"))
                .body(csv.getBytes(StandardCharsets.UTF_8));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        importService.delete(tenantGuard.currentOrganizationId(), id);
    }
}
