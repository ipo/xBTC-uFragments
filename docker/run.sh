#!/usr/bin/env bash

set -e

DOCKER_IMAGE=xbtc
CONTAINER_NAME=xbtc

docker build -t $DOCKER_IMAGE -f docker/Dockerfile .

docker run -it \
    --rm \
    --name $CONTAINER_NAME \
    --net host \
    $DOCKER_IMAGE $@
#    --volume `pwd`/:/code/:ro \
