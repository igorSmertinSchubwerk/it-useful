# syntax=docker/dockerfile:1.7

FROM maven:3.9-eclipse-temurin-21-alpine AS build
WORKDIR /workspace

COPY pom.xml ./
RUN --mount=type=cache,target=/root/.m2 \
    mvn -B -Dmaven.test.skip=true dependency:go-offline

COPY src ./src
RUN --mount=type=cache,target=/root/.m2 \
    mvn -B -Dmaven.test.skip=true package && \
    cp target/it-useful-backend-*.jar /workspace/app.jar

FROM eclipse-temurin:21-jre-alpine AS runtime
RUN addgroup --system app && adduser --system --ingroup app app
WORKDIR /app

COPY --from=build --chown=app:app /workspace/app.jar /app/app.jar
RUN mkdir -p /app/uploads && chown app:app /app/uploads

ENV BACKEND_PORT=8080 \
    SERVER_ADDRESS=0.0.0.0 \
    UPLOAD_DIR=/app/uploads
EXPOSE 8080
USER app

HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=10 \
    CMD wget -qO- "http://127.0.0.1:${BACKEND_PORT}/actuator/health" >/dev/null || exit 1

ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-jar", "/app/app.jar"]
