# IntelliJ IDEA with WSL

## Open the project

Open the repository through its WSL path:

```text
\\wsl.localhost\Ubuntu\home\isn\workspace\icebreaker\it-useful
```

Do not copy the repository into the Windows filesystem. Project-specific `.idea` files remain ignored so personal IDE settings are not committed.

## Configure Java

1. Open **File → Project Structure → SDKs**.
2. Add a JDK from the WSL distribution.
3. Select `/home/isn/.local/share/jdks/temurin-21`.
4. Set the project language level to Java 21.

## Import Maven

1. Open `backend/pom.xml` as a Maven project.
2. Use the Maven wrapper from `backend/mvnw`.
3. Ensure Maven runs through the Ubuntu WSL environment.
4. Set the active Spring profile to `local` for application runs.

The local profile can start the root PostgreSQL Compose service through Spring Boot. Alternatively, run `docker compose up -d --wait postgres` from the repository root before starting the backend.

## Recommended plugins

- Java
- Maven
- Spring and Spring Boot (available in IntelliJ IDEA Ultimate)
- Docker
- Database tools (available in IntelliJ IDEA Ultimate)

IntelliJ IDEA Community can build and run the Maven project, but some Spring-specific navigation and database tooling require Ultimate.

## Verify outside the IDE

The terminal remains the source of truth:

```bash
./scripts/verify-toolchain.sh
./scripts/test-backend.sh
```

Once both commands pass, import failures in IntelliJ are normally SDK, Maven-wrapper, or WSL-environment configuration issues rather than project issues.
