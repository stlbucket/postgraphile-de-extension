docker rm -f $(docker ps -aq)
docker run --name psql -v /Users/buckfactor/pg11data:/var/lib/postgresql/data -e POSTGRES_PASSWORD=1234 -p 5432:5432 -d postgres:11.1-alpine