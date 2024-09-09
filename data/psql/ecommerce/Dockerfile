FROM postgres:15 as base

FROM base AS image-amd64

COPY schema.sql /docker-entrypoint-initdb.d/
RUN chmod a+r /docker-entrypoint-initdb.d/*

FROM base AS image-arm64

COPY schema.sql /docker-entrypoint-initdb.d/
COPY seed.sql /docker-entrypoint-initdb.d/
RUN chmod a+r /docker-entrypoint-initdb.d/*

ARG TARGETPLATFORM
ARG BUILDPLATFORM

RUN echo "I am running on $BUILDPLATFORM, building for $TARGETPLATFORM"
