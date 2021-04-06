# latias-backend

The frontend and all its functionality are located [here](https://github.com/sgronlund/latias-proj)

## First time

When you've successfully cloned this repo, enter the src folder and run the following command :
```
npm ci
``` 
This installs all the dependencies this project requires.
This process should not differ from MacOS, Linux or Windows assuming you've succesfully installed NodeJS on your host machine.

## Client-Server session

### Server
When initiating the Client-Server session you must first start the server. To do this enter the `server`-directory which exists in the `src`-directory and run the command:
```bash
node server.js
```

If everything is working your terminal should look something like this:
![image](https://user-images.githubusercontent.com/55285451/113585007-eaae8c80-962b-11eb-9f0c-616a5c71464e.png)


### Client

To connect a client, enter the src folder from another terminal and simply run:
```bash
npm start
```

Then Expo will launch in your browser and you can choose between previewing in a browser or using a iOS/Android emulator.
If you choose the browser your console should look something like this:

![image](https://user-images.githubusercontent.com/55285451/113585858-1120f780-962d-11eb-81f5-9c4978737d20.png)
