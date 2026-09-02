# WSL development setup

Run project commands inside Ubuntu on WSL from:

```bash
cd ~/workspace/icebreaker/it-useful
```

The Windows Codex desktop app and editor can open this directory through WSL integration. Java and Node.js used by the project must resolve to Linux binaries, not executables under `/mnt/c`.

## Required tools

- Git
- Docker and Docker Compose
- Java 21 JDK
- Node.js 24 LTS and npm

The repository pins the Java major in `.java-version` and the Node major in `.nvmrc`.

## Node.js with nvm

Install nvm for the current WSL user:

```bash
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.7/install.sh | bash
source "$HOME/.nvm/nvm.sh"
```

Install and select the repository version:

```bash
cd ~/workspace/icebreaker/it-useful
nvm install
nvm alias default 24
nvm use
```

The checked-in `.nvmrc` makes `nvm install` and `nvm use` select Node.js 24 LTS.

## Java 21

Ubuntu 24.04 provides `openjdk-21-jdk`. If sudo is available, install it with:

```bash
sudo apt update
sudo apt install openjdk-21-jdk
```

This workstation currently uses Eclipse Temurin 21 installed without root access under:

```text
~/.local/share/jdks/temurin-21
```

The `java`, `javac`, `jar`, and `javadoc` commands are linked into `~/.local/bin`. The standard WSL shell setup already adds that directory to `PATH`.

For tools that explicitly require `JAVA_HOME`, use:

```bash
export JAVA_HOME="$HOME/.local/share/jdks/temurin-21"
```

## Verify the toolchain

From the repository root, run:

```bash
./scripts/verify-toolchain.sh
```

The script fails when Java is not version 21, Node is not version 24, or Node resolves to a Windows path.

## Currently verified versions

- Eclipse Temurin JDK `21.0.12.1`
- Node.js `24.20.0`
- npm `11.19.0`
- Docker Engine `29.1.3`
- Docker Compose `2.40.3`

Patch versions may advance while the pinned major versions remain unchanged.
