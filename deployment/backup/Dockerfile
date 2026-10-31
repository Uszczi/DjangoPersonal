# The database backups: pg_dump from the same image as the db service (so the
# client matches the server and knows pgvector), plus restic for the offsite
# copy.
FROM pgvector/pgvector:pg17-trixie

RUN apt-get update \
    && apt-get install --yes --no-install-recommends restic ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY backup.sh restore.sh schedule.sh /usr/local/bin/

ENTRYPOINT []
CMD ["schedule.sh"]
