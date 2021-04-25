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
    --volume `pwd`/key_xbtc_infura_mainnet.txt:/code/key_xbtc_infura_mainnet.txt:ro \
    --volume `pwd`/key_xbtc_infura_rinkeby.txt:/code/key_xbtc_infura_rinkeby.txt:ro \
    --volume `pwd`/key_xbtc_rpc_bsc_mainnet.txt:/code/key_xbtc_rpc_bsc_mainnet.txt:ro \
    --volume `pwd`/key_xbtc_rpc_bsc_testnet.txt:/code/key_xbtc_rpc_bsc_testnet.txt:ro \
    --volume `pwd`/key_xbtc_mainnet.txt:/code/key_xbtc_mainnet.txt:ro \
    --volume `pwd`/key_xbtc_rinkeby.txt:/code/key_xbtc_rinkeby.txt:ro \
    --volume `pwd`/key_xbtc_bsc_mainnet.txt:/code/key_xbtc_bsc_mainnet.txt:ro \
    --volume `pwd`/key_xbtc_bsc_testnet.txt:/code/key_xbtc_bsc_testnet.txt:ro \
    --volume `pwd`/key_xbtc_etherscan_api_key.txt:/code/key_xbtc_etherscan_api_key.txt:ro \
    --volume `pwd`/key_xbtc_bscscan_api_key.txt:/code/key_xbtc_bscscan_api_key.txt:ro \
    --volume `pwd`/:/src/:rw \
    $DOCKER_IMAGE $@
#    --rm \

#docker container rm $CONTAINER_NAME
