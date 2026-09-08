# Backup and restore

IT Useful stores one logical dataset in two places: PostgreSQL contains
definitions, translations, image metadata, and image order; the upload volume
contains the corresponding image bytes. A useful backup must contain both.

## Create a backup

Run this command from any directory while Docker is available in Ubuntu on WSL:

```bash
~/workspace/icebreaker/it-useful/scripts/project.sh backup
```

The default destination is the `it-useful-backups` directory beside the Git
repository. Supply another directory when the backup should be written to an
external or synchronized drive:

```bash
./scripts/project.sh backup /mnt/d/Backups/it-useful
```

The destination must be outside the repository. The command creates it when
needed and rejects the filesystem root, repository root, and repository
subdirectories. It checks free space before writing and publishes the completed
archive atomically with owner-only permissions.

Backup also rejects unsafe upload paths, missing image files referenced by the
database, and links or special entries in the upload volume. Fix the reported
source inconsistency before trying again.

## Consistency and application availability

The command records whether each Compose service is running, stops the frontend
and backend to quiesce writes, and leaves PostgreSQL available while it creates a
custom-format dump. It then archives the upload volume. The frontend and backend
resume only if they were running before the backup; a previously stopped stack
remains stopped. Expect a brief local outage while the data is captured.

If the command is interrupted or fails, its cleanup handler removes the partial
archive and attempts to restore the previous service state. Read any warning
before assuming the application has restarted.

## Archive format

Each `it-useful-backup-<UTC timestamp>-<process>.tar.gz` contains exactly:

- `manifest.json`, using backup format version 1;
- `database.dump`, a compressed PostgreSQL custom-format dump;
- `uploads.tar.gz`, containing the upload volume contents.

The manifest records the creation time, application revision, database name,
Flyway schema version, file sizes, and SHA-256 checksums. It does not contain the
database password or other secrets. The command validates the PostgreSQL dump
catalogue, tests both gzip streams, and rejects unexpected archive members before
publishing the file.

Do not edit an archive. Copying is safe, but verify its SHA-256 digest after
moving it to long-term storage:

```bash
sha256sum /path/to/it-useful-backup-*.tar.gz
```

## Storage, retention, and encryption

Keep at least one copy on a different physical device or trusted encrypted
backup service. The local archive contains all definition text and uploaded
images, so protect it as carefully as the live application. Use full-disk or
backup-provider encryption and do not commit archives to Git.

For personal local use, a practical starting policy is seven daily copies and
four weekly copies. Adjust it to available space and how costly lost edits would
be. Periodically compare stored checksums and run the automated restore drill
after application or infrastructure changes.

## Restore a backup

Restore replaces the live Compose database and every file in its upload volume.
Choose the required archive explicitly and include the confirmation phrase:

```bash
./scripts/project.sh restore \
  /path/to/it-useful-backup-20260908T120000Z-1234.tar.gz \
  confirm-replace-data
```

Before replacing anything, the command verifies:

- the outer gzip stream and exact three-member archive layout;
- backup format version 1 and a Flyway version known to this checkout;
- declared file sizes and SHA-256 checksums;
- the PostgreSQL dump catalogue;
- every upload path and entry type, rejecting traversal paths and links;
- enough temporary disk space to extract the declared files.

The source archive must be outside the Git repository. Its recorded database
name must match the currently configured `DB_NAME`.

## Pre-restore safety backup and recovery

After validation, restore automatically creates a fresh backup of the data it is
about to replace. By default, that safety archive is written to the sibling
`it-useful-backups` directory. To use another location, set it only for this
command:

```bash
IT_USEFUL_BACKUP_DIR=/mnt/d/Backups/it-useful \
  ./scripts/project.sh restore /path/to/backup.tar.gz confirm-replace-data
```

The command reports both `RESTORED_ARCHIVE` and `SAFETY_BACKUP` after success.
Keep the safety backup until the application content has been inspected.

If replacement fails after it begins, frontend and backend remain stopped. Read
the error and retain the reported safety archive. Do not repeatedly run restore
or manually edit the volumes; diagnose the failed step first, then restore the
safety archive with the same guarded command.

After success, the command checks the Flyway version and verifies that every
database image reference has a matching file. It then returns PostgreSQL,
backend, and frontend to their previous running or stopped states.

## Restore drill

Run the automated disposable drill after changing backup, restore, database,
image-storage, or Compose behavior:

```bash
./scripts/project.sh test-backup
```

The drill seeds all three translations and ordered image metadata, creates a
backup, corrupts both data stores, rejects incorrect confirmation and a tampered
archive, restores the backup, verifies text and exact image bytes, checks the
automatic safety backup, and confirms service-state recovery. It never targets
the normal Compose project.
