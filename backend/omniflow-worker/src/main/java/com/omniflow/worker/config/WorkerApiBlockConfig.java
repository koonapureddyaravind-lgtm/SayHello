package com.omniflow.worker.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * The worker scans {@code com.omniflow} so it can reuse domain services and repositories,
 * which also puts the module REST controllers on the classpath. They are not part of the
 * worker's contract and there is no tenant authentication here, so every {@code /api/*}
 * request is rejected before it reaches a controller.
 */
@Configuration(proxyBeanMethods = false)
public class WorkerApiBlockConfig {

    @Bean
    public FilterRegistrationBean<OncePerRequestFilter> blockApiRequests() {
        OncePerRequestFilter filter = new OncePerRequestFilter() {
            @Override
            protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                            FilterChain filterChain) throws ServletException, IOException {
                String path = request.getRequestURI();
                if (path != null && path.startsWith("/api/")) {
                    response.setStatus(HttpServletResponse.SC_NOT_FOUND);
                    response.setContentType("application/json");
                    response.getWriter().write("{\"success\":false,\"data\":null,"
                            + "\"error\":{\"code\":\"NOT_FOUND\",\"message\":\"Not found\"},"
                            + "\"timestamp\":\"" + java.time.Instant.now() + "\"}");
                    return;
                }
                filterChain.doFilter(request, response);
            }
        };
        FilterRegistrationBean<OncePerRequestFilter> registration = new FilterRegistrationBean<>(filter);
        registration.addUrlPatterns("/api/*");
        registration.setOrder(1);
        return registration;
    }
}
