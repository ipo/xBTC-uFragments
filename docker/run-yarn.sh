#!/usr/bin/env bash

set -e

DOCKER_IMAGE=yarn
CONTAINER_NAME=yarn

docker build -t $DOCKER_IMAGE -f docker/Dockerfile_yarn .

set +e
docker container rm $CONTAINER_NAME
set -e

docker run -it \
    --name $CONTAINER_NAME \
    --net host \
    --volume `pwd`/:/code/:rw \
    $DOCKER_IMAGE $@
#    --rm \

docker container rm $CONTAINER_NAME
