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
    --volume `pwd`/:/code/:ro \
    $DOCKER_IMAGE $@
#    --rm \

set +e
rm -rf build node_modules
set -e

docker cp $CONTAINER_NAME:/code/build/ `pwd`/build
docker cp $CONTAINER_NAME:/code/node_modules/ `pwd`/node_modules

docker container rm $CONTAINER_NAME
