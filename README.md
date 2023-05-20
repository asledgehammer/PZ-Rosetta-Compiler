# PZDocs-Yaml-Compiler

## Install

1. Install [node.js](https://nodejs.org/en/download/), [yarn](https://yarnpkg.com/getting-started/install) (or use npm).
2. Clone this repository, and using a terminal navigate to its directory.
3. Run `yarn` or `npm install` to install the dependencies.
4. Copy the offline JavaDocs for ProjectZomboid in the `./docs/` directory. 
> NOTE: Copy the entire contents of the folder containing `index.html`, not a parent folder.

## Build & Run

1. Copy the contents of the `.env.example` file to a `.env` next to it, and edit it with your values.
2. Run `yarn build` or `npm build` to build the files.
3. Run `yarn start` or `npm start` to start the application.

-   You can run `yarn dev` or `npm dev` to combine the 2 steps above, while listening to changes and restarting automatically.
