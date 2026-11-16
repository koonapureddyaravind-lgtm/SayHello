# Multi-stage build for the Spring Boot API and worker.
# Build context is the repository root so Flyway SQL in /database can be packaged.
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /workspace

# Cache dependencies first. Modules stay under /workspace/backend so the
# Flyway resource path (../../database/migrations) resolves to /workspace/database.
COPY backend/pom.xml ./backend/pom.xml
COPY backend/omniflow-common/pom.xml ./backend/omniflow-common/pom.xml
COPY backend/omniflow-identity/pom.xml ./backend/omniflow-identity/pom.xml
COPY backend/omniflow-organization/pom.xml ./backend/omniflow-organization/pom.xml
COPY backend/omniflow-crm/pom.xml ./backend/omniflow-crm/pom.xml
COPY backend/omniflow-segmentation/pom.xml ./backend/omniflow-segmentation/pom.xml
COPY backend/omniflow-consent/pom.xml ./backend/omniflow-consent/pom.xml
COPY backend/omniflow-template/pom.xml ./backend/omniflow-template/pom.xml
COPY backend/omniflow-campaign/pom.xml ./backend/omniflow-campaign/pom.xml
COPY backend/omniflow-messaging/pom.xml ./backend/omniflow-messaging/pom.xml
COPY backend/omniflow-email/pom.xml ./backend/omniflow-email/pom.xml
COPY backend/omniflow-whatsapp/pom.xml ./backend/omniflow-whatsapp/pom.xml
COPY backend/omniflow-sms/pom.xml ./backend/omniflow-sms/pom.xml
COPY backend/omniflow-automation/pom.xml ./backend/omniflow-automation/pom.xml
COPY backend/omniflow-inbox/pom.xml ./backend/omniflow-inbox/pom.xml
COPY backend/omniflow-analytics/pom.xml ./backend/omniflow-analytics/pom.xml
COPY backend/omniflow-integration/pom.xml ./backend/omniflow-integration/pom.xml
COPY backend/omniflow-billing/pom.xml ./backend/omniflow-billing/pom.xml
COPY backend/omniflow-audit/pom.xml ./backend/omniflow-audit/pom.xml
COPY backend/omniflow-app/pom.xml ./backend/omniflow-app/pom.xml
COPY backend/omniflow-worker/pom.xml ./backend/omniflow-worker/pom.xml
RUN mvn -B -ntp -q -f backend/pom.xml dependency:go-offline -DskipTests || true

COPY database ./database
COPY backend ./backend
RUN mvn -B -ntp -f backend/pom.xml -DskipTests package

FROM eclipse-temurin:21-jre-alpine AS runtime
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=build /workspace/backend/omniflow-app/target/omniflow-api.jar /app/app.jar
COPY --from=build /workspace/backend/omniflow-worker/target/omniflow-worker.jar /app/worker.jar
USER app
EXPOSE 8080 8081
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-XX:+UseG1GC", "-jar"]
CMD ["/app/app.jar"]
