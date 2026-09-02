# IntelliJ IDEA with WSL

## PhpStorm and IntelliJ IDEA have different roles

PhpStorm does not provide the Java project model, Maven integration, or the
**File → Project Structure** dialog described below. Its bundled Java runtime
runs PhpStorm itself; it is not a Java development SDK.

Use:

- **IntelliJ IDEA** for the Spring Boot backend in `backend/`.
- **PhpStorm** for the React frontend after it is created.

IntelliJ IDEA 2025.3 and newer uses one unified installer. Core Java and Maven
development is free. Advanced Spring assistance requires an Ultimate
subscription or trial, but it is not required to build or run this project.

On this workstation, IntelliJ IDEA 2026.2.1 is installed for the current
Windows user at:

```text
C:\Users\isn\AppData\Local\Programs\IntelliJ IDEA 2026.2.1
```

## Open the project

For the first backend import, open this Maven file in IntelliJ IDEA:

```text
\\wsl.localhost\Ubuntu\home\isn\workspace\icebreaker\it-useful\backend\pom.xml
```

Choose **Open as Project** and **Trust Project** when prompted. IntelliJ IDEA
will detect the Maven wrapper in `backend/.mvn/` and import the backend.

To work with the entire repository later, open this directory in another IDE
window and add `backend/pom.xml` from the Maven tool window:

```text
\\wsl.localhost\Ubuntu\home\isn\workspace\icebreaker\it-useful
```

Do not copy the repository into the Windows filesystem. Project-specific `.idea` files remain ignored so personal IDE settings are not committed.

## Configure Java

These controls exist in IntelliJ IDEA, not PhpStorm.

1. Open **File → Project Structure** (`Ctrl+Alt+Shift+S`).
2. Select **Platform Settings → SDKs**, then **Add SDK → JDK**.
3. Choose the Ubuntu WSL distribution and select
   `/home/isn/.local/share/jdks/temurin-21`.
4. Under **Project Settings → Project**, select that JDK as the project SDK.
5. Set the project language level to **21 – Record patterns, pattern matching
   for switch**.

## Import Maven

1. Open **View → Tool Windows → Maven**.
2. Confirm `it-useful-backend` appears and click **Reload All Maven Projects**.
3. Open **Settings → Build, Execution, Deployment → Build Tools → Maven**.
4. Set **Maven home path** to **Use Maven wrapper**.
5. Set the Maven importer and runner JDK to the project JDK.
6. Set the active Spring profile to `local` for application runs.

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
