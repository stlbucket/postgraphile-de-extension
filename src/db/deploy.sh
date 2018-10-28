#!/usr/bin/env bash

# ./execute.sh ./scripts/0100-philede.sql


# ./execute.sh ./scripts/0105-relationships.sql
# ./execute.sh ./scripts/0106-comments.sql
# ./execute.sh ./scripts/0110-triggers.sql
# ./execute.sh ./scripts/0200-release-functions.sql
# ./execute.sh ./scripts/0210-patch-functions.sql
# ./execute.sh ./scripts/0220-minor-functions.sql
# ./execute.sh ./scripts/0300-release-ddl.sql
# ./execute.sh ./scripts/0400-seed-data.sql
# ./execute.sh ./scripts/1000-import-project.sql
# ./execute.sh ./scripts/9999-seed.sql

# ./execute.sh ./scripts/pde.sql


# ./execute.sh ./scripts/9900-dummy-data.sql

source ./error_exit.sh

packages=(
  ./scripts/0100-philede.sql
  ./scripts/0105-relationships.sql
  ./scripts/0106-comments.sql
  ./scripts/0110-triggers.sql
  ./scripts/0200-release-functions.sql
  ./scripts/0210-patch-functions.sql
  ./scripts/0220-minor-functions.sql
  ./scripts/0300-release-ddl.sql
  ./scripts/0400-seed-data.sql
  ./scripts/1000-import-project.sql
  ./scripts/9999-seed.sql
)

for i in ${packages[@]};
do
  echo "DEPLOYING PACKAGE ------------------------------------------------------------" $i
  (./execute.sh $i) || error_exit "FAILURE TO DEPLOY: $i"
done
