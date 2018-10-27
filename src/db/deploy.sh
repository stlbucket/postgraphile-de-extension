#!/usr/bin/env bash

./execute.sh ./scripts/0100-philede.sql
./execute.sh ./scripts/0105-relationships.sql
./execute.sh ./scripts/0106-comments.sql
./execute.sh ./scripts/0110-triggers.sql
./execute.sh ./scripts/0200-release-functions.sql
./execute.sh ./scripts/0200-patch-functions.sql
./execute.sh ./scripts/0300-release-ddl.sql
./execute.sh ./scripts/0400-seed-data.sql
./execute.sh ./scripts/1000-import-project.sql

# ./execute.sh ./scripts/pde.sql


# ./execute.sh ./scripts/9900-dummy-data.sql
