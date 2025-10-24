.PHONY: login create push

all: install

install:
	npm install

login: install
	npx clasp login

create: install
	npx clasp create --title "GitHub Email Labels" --rootDir .

push: install
	npx clasp push --force
