.PHONY: login create push refresh verify

all: install

install:
	npm install

login: install
	npx clasp login

create: install
	npx clasp create --title "GitHub Email Labels" --rootDir .

push: install
	npx clasp push --force

refresh:
	bash generate-closed-data.sh

verify: install
	npx eslint src/
