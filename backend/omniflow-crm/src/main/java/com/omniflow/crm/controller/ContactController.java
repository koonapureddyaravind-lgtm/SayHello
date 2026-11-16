package com.omniflow.crm.controller;

import com.omniflow.common.api.ApiResponse;
import com.omniflow.common.api.PageQuery;
import com.omniflow.common.api.PageResponse;
import com.omniflow.common.tenant.TenantGuard;
import com.omniflow.crm.dto.ActivityView;
import com.omniflow.crm.dto.ContactAttributeView;
import com.omniflow.crm.dto.ContactView;
import com.omniflow.crm.dto.CreateAttributeRequest;
import com.omniflow.crm.dto.ImportJsonRequest;
import com.omniflow.crm.dto.ImportResult;
import com.omniflow.crm.dto.UpsertContactRequest;
import com.omniflow.crm.service.ContactService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/contacts")
@RequiredArgsConstructor
public class ContactController {

    private final ContactService contactService;
    private final TenantGuard tenantGuard;

    @GetMapping
    public ApiResponse<PageResponse<ContactView>> list(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) UUID tagId,
            @RequestParam(required = false) String status) {
        UUID organizationId = tenantGuard.currentOrganizationId();
        return ApiResponse.ok(contactService.list(organizationId, PageQuery.of(page, size), q, tagId, status));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ContactView> create(@Valid @RequestBody UpsertContactRequest request) {
        UUID organizationId = tenantGuard.currentOrganizationId();
        return ApiResponse.ok(contactService.create(organizationId, tenantGuard.currentUserIdOrNull(), request));
    }

    @GetMapping("/{id}")
    public ApiResponse<ContactView> get(@PathVariable UUID id) {
        return ApiResponse.ok(contactService.get(tenantGuard.currentOrganizationId(), id));
    }

    @PatchMapping("/{id}")
    public ApiResponse<ContactView> update(@PathVariable UUID id,
                                           @Valid @RequestBody UpsertContactRequest request) {
        return ApiResponse.ok(contactService.update(tenantGuard.currentOrganizationId(), id, request));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        contactService.delete(tenantGuard.currentOrganizationId(), id);
    }

    @PostMapping(value = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<ImportResult> importCsv(@RequestParam(value = "file", required = false) MultipartFile file) {
        UUID organizationId = tenantGuard.currentOrganizationId();
        return ApiResponse.ok(contactService.importCsv(organizationId, tenantGuard.currentUserIdOrNull(), file));
    }

    @PostMapping("/import-json")
    public ApiResponse<ImportResult> importJson(@RequestBody ImportJsonRequest request) {
        UUID organizationId = tenantGuard.currentOrganizationId();
        return ApiResponse.ok(contactService.importJson(organizationId, tenantGuard.currentUserIdOrNull(), request));
    }

    @PostMapping(value = "/import", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ApiResponse<ImportResult> importJsonAtImport(@RequestBody ImportJsonRequest request) {
        UUID organizationId = tenantGuard.currentOrganizationId();
        return ApiResponse.ok(contactService.importJson(organizationId, tenantGuard.currentUserIdOrNull(), request));
    }

    @GetMapping(value = "/export", produces = "text/csv")
    public ResponseEntity<byte[]> export() {
        String csv = contactService.exportCsv(tenantGuard.currentOrganizationId());
        byte[] body = csv.getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"contacts.csv\"")
                .contentType(MediaType.parseMediaType("text/csv;charset=UTF-8"))
                .body(body);
    }

    @PostMapping("/{id}/tags/{tagId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void addTag(@PathVariable UUID id, @PathVariable UUID tagId) {
        contactService.addTag(tenantGuard.currentOrganizationId(), id, tagId);
    }

    @DeleteMapping("/{id}/tags/{tagId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeTag(@PathVariable UUID id, @PathVariable UUID tagId) {
        contactService.removeTag(tenantGuard.currentOrganizationId(), id, tagId);
    }

    @GetMapping("/{id}/activities")
    public ApiResponse<PageResponse<ActivityView>> activities(
            @PathVariable UUID id,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        UUID organizationId = tenantGuard.currentOrganizationId();
        return ApiResponse.ok(contactService.activities(organizationId, id, PageQuery.of(page, size)));
    }

    @GetMapping("/attributes")
    public ApiResponse<List<ContactAttributeView>> attributes() {
        return ApiResponse.ok(contactService.listAttributes(tenantGuard.currentOrganizationId()));
    }

    @PostMapping("/attributes")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ContactAttributeView> createAttribute(
            @Valid @RequestBody CreateAttributeRequest request) {
        return ApiResponse.ok(contactService.createAttribute(tenantGuard.currentOrganizationId(), request));
    }
}
