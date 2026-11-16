package com.omniflow.email.provider;

import com.omniflow.common.domain.enums.Channel;
import com.omniflow.common.port.ProviderAccountInfo;
import com.omniflow.common.port.ProviderConnectivityChecker;
import com.omniflow.messaging.provider.MessageProvider;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;

import java.io.UnsupportedEncodingException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.UUID;

/**
 * SMTP adapter. Also serves Amazon SES, which exposes an SMTP endpoint.
 * A fresh {@link JavaMailSenderImpl} is built per send from the provider account
 * credentials/config, falling back to the shared {@code omniflow.email.*} env
 * defaults when a workspace leaves its credentials blank.
 */
@Component
public class SmtpEmailProvider implements MessageProvider, ProviderConnectivityChecker {

    private static final Logger log = LoggerFactory.getLogger(SmtpEmailProvider.class);

    private static final String DEFAULT_FROM = "noreply@localhost";
    private static final int DEFAULT_TIMEOUT_MILLIS = 10_000;

    private final String defaultHost;
    private final String defaultPort;
    private final String defaultUsername;
    private final String defaultPassword;
    private final String defaultStartTls;
    private final String defaultFrom;

    public SmtpEmailProvider(
            @Value("${omniflow.email.host:localhost}") String defaultHost,
            @Value("${omniflow.email.port:}") String defaultPort,
            @Value("${omniflow.email.username:}") String defaultUsername,
            @Value("${omniflow.email.password:}") String defaultPassword,
            @Value("${omniflow.email.starttls:}") String defaultStartTls,
            @Value("${omniflow.email.from:}") String defaultFrom) {
        this.defaultHost = defaultHost;
        this.defaultPort = defaultPort;
        this.defaultUsername = defaultUsername;
        this.defaultPassword = defaultPassword;
        this.defaultStartTls = defaultStartTls;
        this.defaultFrom = defaultFrom;
    }

    @Override
    public String providerCode() {
        return "SMTP";
    }

    @Override
    public List<String> aliases() {
        return List.of("SES");
    }

    @Override
    public boolean supports(String provider, Channel channel) {
        return channel == Channel.EMAIL
                && ("SMTP".equalsIgnoreCase(provider) || "SES".equalsIgnoreCase(provider));
    }

    /**
     * Opens a real SMTP session (connect + EHLO + AUTH when credentials exist) so the
     * integrations screen can prove the stored credentials work before a campaign runs.
     */
    @Override
    public Result check(ProviderAccountInfo account) {
        Map<String, String> credentials = account.credentials() == null ? Map.of() : account.credentials();
        Map<String, Object> config = account.config() == null ? Map.of() : account.config();
        try {
            JavaMailSenderImpl sender = buildSender(credentials, config);
            sender.testConnection();
            return Result.success(
                    "SMTP connection verified with " + sender.getHost() + ":" + sender.getPort());
        } catch (MessagingException e) {
            log.warn("SMTP connectivity check failed: {}", safeMessage(e));
            return Result.failure("SMTP connection failed: " + safeMessage(e));
        } catch (Exception e) {
            log.warn("SMTP connectivity check failed unexpectedly: {}", safeMessage(e));
            return Result.failure("SMTP connection failed: " + safeMessage(e));
        }
    }

    @Override
    public SendResult send(SendRequest request) {
        if (request.to() == null || request.to().isBlank()) {
            return SendResult.failure("INVALID_EMAIL", "Recipient address is required", Map.of());
        }
        Map<String, String> credentials = request.credentials() == null ? Map.of() : request.credentials();
        Map<String, Object> config = request.config() == null ? Map.of() : request.config();

        JavaMailSenderImpl mailSender;
        MimeMessage message;
        try {
            mailSender = buildSender(credentials, config);
            message = mailSender.createMimeMessage();
            compose(message, request);
        } catch (Exception e) {
            log.warn("SMTP composition failed for messageId={}: {}", request.messageId(), safeMessage(e));
            return SendResult.failure("INVALID_EMAIL", safeMessage(e), Map.of());
        }

        try {
            mailSender.send(message);
            String providerMessageId = message.getMessageID();
            if (providerMessageId == null || providerMessageId.isBlank()) {
                providerMessageId = request.messageId() != null
                        ? request.messageId().toString()
                        : UUID.randomUUID().toString();
            }
            return SendResult.success(providerMessageId, Map.of("accepted", true));
        } catch (MailException e) {
            log.warn("SMTP send failed for messageId={}: {}", request.messageId(), safeMessage(e));
            return SendResult.failure("EMAIL_SEND_FAILED", safeMessage(e), Map.of());
        } catch (Exception e) {
            log.warn("SMTP send failed unexpectedly for messageId={}: {}", request.messageId(), safeMessage(e));
            return SendResult.failure("EMAIL_SEND_FAILED", safeMessage(e), Map.of());
        }
    }

    private void compose(MimeMessage message, SendRequest request)
            throws MessagingException, UnsupportedEncodingException {
        MimeMessageHelper helper = new MimeMessageHelper(message, true, StandardCharsets.UTF_8.name());

        String from = firstNonBlank(request.from(), defaultFrom, DEFAULT_FROM);
        String fromName = request.fromName();
        if (fromName != null && !fromName.isBlank()) {
            helper.setFrom(new InternetAddress(from, fromName, StandardCharsets.UTF_8.name()));
        } else {
            helper.setFrom(from);
        }

        helper.setTo(request.to().trim());
        helper.setSubject(request.subject() == null ? "" : request.subject());

        String plain = request.body() == null ? "" : request.body();
        String html = request.htmlBody();
        if (html != null && !html.isBlank()) {
            helper.setText(plain.isEmpty() ? stripHtml(html) : plain, html);
        } else {
            helper.setText(plain);
        }

        if (request.messageId() != null) {
            message.setHeader("X-ComGpt-Message-Id", request.messageId().toString());
        }
        if (request.idempotencyKey() != null && !request.idempotencyKey().isBlank()) {
            message.setHeader("X-ComGpt-Idempotency-Key", request.idempotencyKey());
        }
    }

    private JavaMailSenderImpl buildSender(Map<String, String> credentials, Map<String, Object> config) {
        String host = firstNonBlank(
                credentials.get("host"),
                asString(config.get("host")),
                defaultHost);
        String username = firstNonBlank(credentials.get("username"), defaultUsername);
        String password = firstNonBlank(credentials.get("password"), defaultPassword);
        boolean auth = username != null && !username.isBlank();
        boolean ssl = resolveBoolean(
                firstNonNull(config.get("ssl"), config.get("smtps"), credentials.get("ssl")),
                fallbackPort(credentials, config) == 465);
        boolean starttls = resolveBoolean(
                firstNonNull(config.get("starttls"), config.get("startTls"), blankToNull(defaultStartTls)),
                auth && !ssl);
        int port = resolveInt(
                firstNonBlank(credentials.get("port"), asString(config.get("port")), defaultPort),
                ssl ? 465 : auth ? 587 : 25);

        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        sender.setHost(host);
        sender.setPort(port);
        sender.setProtocol(ssl ? "smtps" : "smtp");
        sender.setDefaultEncoding(StandardCharsets.UTF_8.name());
        if (auth) {
            sender.setUsername(username);
            sender.setPassword(password);
        }

        Properties properties = sender.getJavaMailProperties();
        properties.put("mail.smtp.auth", Boolean.toString(auth));
        properties.put("mail.smtp.starttls.enable", Boolean.toString(starttls));
        properties.put("mail.smtp.starttls.required", Boolean.toString(starttls));
        properties.put("mail.smtp.ssl.enable", Boolean.toString(ssl));
        String sslTrust = firstNonBlank(asString(config.get("sslTrust")), asString(config.get("ssl.trust")));
        if (sslTrust != null) {
            properties.put("mail.smtp.ssl.trust", sslTrust);
        }
        properties.put("mail.smtp.connectiontimeout", Integer.toString(DEFAULT_TIMEOUT_MILLIS));
        properties.put("mail.smtp.readtimeout", Integer.toString(DEFAULT_TIMEOUT_MILLIS));
        properties.put("mail.smtp.writetimeout", Integer.toString(DEFAULT_TIMEOUT_MILLIS));
        return sender;
    }

    private static int fallbackPort(Map<String, String> credentials, Map<String, Object> config) {
        return resolveInt(firstNonBlank(credentials.get("port"), asString(config.get("port"))), 0);
    }

    private static Object blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private static Object firstNonNull(Object... values) {
        if (values == null) {
            return null;
        }
        for (Object value : values) {
            if (value != null) {
                return value;
            }
        }
        return null;
    }

    private static String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return null;
    }

    private static String asString(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private static boolean resolveBoolean(Object value, boolean fallback) {
        if (value instanceof Boolean bool) {
            return bool;
        }
        if (value instanceof Number number) {
            return number.intValue() != 0;
        }
        if (value != null) {
            String text = value.toString().trim();
            if ("true".equalsIgnoreCase(text) || "1".equals(text) || "yes".equalsIgnoreCase(text)) {
                return true;
            }
            if ("false".equalsIgnoreCase(text) || "0".equals(text) || "no".equalsIgnoreCase(text)) {
                return false;
            }
        }
        return fallback;
    }

    private static int resolveInt(String value, int fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        try {
            return Integer.parseInt(value.trim());
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    private static String stripHtml(String value) {
        if (value == null) {
            return "";
        }
        return value
                .replaceAll("(?s)<[^>]*>", " ")
                .replace("&nbsp;", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private static String safeMessage(Throwable throwable) {
        return throwable.getMessage() == null ? throwable.getClass().getSimpleName() : throwable.getMessage();
    }
}
