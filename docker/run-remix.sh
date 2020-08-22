#!/usr/bin/env bash

set -e

DOCKER_IMAGE=4c0n/remix-ide
CONTAINER_NAME=remix

docker pull $DOCKER_IMAGE

docker run -it \
    --volume `pwd`/:/app/:ro \
    -p8080:8080 -p65520:65520 \
    --rm \
    --name $CONTAINER_NAME \
    --net host \
    $DOCKER_IMAGE $@
