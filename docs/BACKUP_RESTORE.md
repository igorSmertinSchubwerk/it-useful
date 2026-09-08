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
database password or other secrets. The command tests the outer gzip stream and
rejects unexpected archive members before publishing the file.

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
once restore support is available.

## Restore status

Restore is deliberately not part of this first group because it replaces live
data. The next group will add explicit confirmation, archive and checksum
validation, an automatic pre-restore safety backup, schema compatibility checks,
and a disposable end-to-end restore test. Until that command is merged, preserve
the archive and do not manually replace database or volume files.
