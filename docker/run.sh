#!/usr/bin/env bash

set -e

DOCKER_IMAGE=xbtc
CONTAINER_NAME=xbtc

docker build -t $DOCKER_IMAGE -f docker/Dockerfile .

set +e
docker container rm $CONTAINER_NAME
set -e

docker run -it \
    --name $CONTAINER_NAME \
    --net host \
    $DOCKER_IMAGE $@
#    --rm \

#docker container rm $CONTAINER_NAME
