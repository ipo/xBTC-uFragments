FROM ubuntu:18.04

RUN apt-get update && apt-get install -y --no-install-recommends \
    emacs \
    git \
    wget \
    ca-certificates \
    curl \
    nmap \
    less \
    gcc \
    g++ \
    libmysqlclient-dev \
    python3.6 \
    python3.6-dev \
    python3-distutils \
    python3-mysqldb
RUN cd /tmp/ && wget https://bootstrap.pypa.io/get-pip.py && python3 get-pip.py

RUN pip install base58
RUN pip install web3
RUN pip install py-solc
RUN pip install pylint
RUN pip install SQLAlchemy
RUN pip install arrow
RUN pip install pycryptodome
RUN pip3 install mysqlclient

#RUN apt-get install -y npm
RUN apt-get install -y sudo lsof
RUN apt-get install -y make

#RUN apt-get install -y software-properties-common && \
#    python3 -m solc.install v0.4.25 && \
#    cp $HOME/.py-solc/solc-v0.4.25/bin/solc /usr/local/bin/

WORKDIR /code/

# install dependencies
RUN curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.33.2/install.sh | bash && export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" && [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion" && nvm install lts/dubnium && nvm use lts/dubnium
ADD package-lock.json package.json /code/
RUN export NVM_DIR="$HOME/.nvm" && \. "$NVM_DIR/nvm.sh" && npm install
RUN export NVM_DIR="$HOME/.nvm" && \. "$NVM_DIR/nvm.sh" && npx setup-local-chains

ADD . /code/

# validate code
RUN export NVM_DIR="$HOME/.nvm" && \. "$NVM_DIR/nvm.sh" && npm run lint
#RUN export NVM_DIR="$HOME/.nvm" && \. "$NVM_DIR/nvm.sh" && npm run coverage

# run tests
#CMD export NVM_DIR="$HOME/.nvm" && \. "$NVM_DIR/nvm.sh" && npx start-chain ganacheUnitTest && testrpc-sc --gasLimit 999999999999999999999999 & sleep 10 && export NVM_DIR="$HOME/.nvm" && \. "$NVM_DIR/nvm.sh" && npm test && npx truffle --network ganacheUnitTest test test/unit/UFragments.js
CMD export NVM_DIR="$HOME/.nvm" && \. "$NVM_DIR/nvm.sh" && npx start-chain ganacheUnitTest && testrpc-sc --gasLimit 999999999999999999999999 > /dev/null & sleep 10 && export NVM_DIR="$HOME/.nvm" && \. "$NVM_DIR/nvm.sh" && npm test
