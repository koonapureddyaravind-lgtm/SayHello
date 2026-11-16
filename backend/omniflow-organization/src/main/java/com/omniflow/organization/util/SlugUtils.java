package com.omniflow.organization.util;

import com.omniflow.organization.repository.OrganizationRepository;

import java.text.Normalizer;
import java.util.Locale;

public final class SlugUtils {

    private static final int MAX_LENGTH = 90;

    private SlugUtils() {
    }

    public static String slugify(String input) {
        if (input == null || input.isBlank()) {
            return "workspace";
        }
        String normalized = Normalizer.normalize(input, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-+", "")
                .replaceAll("-+$", "");
        if (normalized.isBlank()) {
            return "workspace";
        }
        if (normalized.length() > MAX_LENGTH) {
            normalized = normalized.substring(0, MAX_LENGTH).replaceAll("-+$", "");
        }
        return normalized;
    }

    public static String uniqueSlug(String desired, OrganizationRepository repository) {
        String base = slugify(desired);
        String candidate = base;
        int suffix = 2;
        while (repository.existsBySlug(candidate)) {
            candidate = base + "-" + suffix;
            suffix++;
        }
        return candidate;
    }
}
