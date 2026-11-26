# syntax=docker/dockerfile:1.7

# Empty by default. CI passes its cached Maven repository as the build context
# named maven-repository, so CI builds do not ask Maven Central, which
# rate-limits the shared runners. Maven reads it read-only as a tail repository.
FROM scratch AS maven-repository

# The same Maven as backend/.mvn/wrapper, so the cache from the test job has
# exactly the artifacts this build resolves. Update both together.
FROM maven:3.10.2-eclipse-temurin-21-alpine AS build
WORKDIR /workspace

# Anything the seed lacks still comes from Maven Central, which answers bursts
# with HTTP 429. Each download retries 6 times, waiting 15 s more every time.
# Retrying stops once the next wait would exceed intervalMax, so it covers the
# 90 s wait of the last retry.
ENV MAVEN_ARGS="-Daether.transport.http.retryHandler.count=6 -Daether.transport.http.retryHandler.interval=15000 -Daether.transport.http.retryHandler.intervalMax=90000"

COPY pom.xml ./
COPY src ./src
RUN --mount=type=cache,target=/root/.m2 \
    --mount=type=bind,from=maven-repository,target=/seed \
    mvn -B -Dmaven.test.skip=true -Dmaven.repo.local.tail=/seed package && \
    cp target/it-useful-backend-*.jar /workspace/app.jar

FROM eclipse-temurin:21-jre-alpine AS runtime
RUN apk upgrade --no-cache && \
    addgroup --system app && adduser --system --ingroup app app
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
