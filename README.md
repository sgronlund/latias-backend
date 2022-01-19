**NOTE:**
This project was done for the course [1DT003 Computer Systems with Project Work at Uppsala University](https://www.uu.se/en/admissions/freestanding-courses/course-syllabus/?kKod=1DT003&lasar=) by the following members:

* [AGUPTA375](https://github.com/AGUPTA375)
* [Skrotsamlarn](https://github.com/Skrotsamlarn)
* [RichardG99](https://github.com/RichardG99)
* [Kimiya98901](https://github.com/Kimiya98901)
* [JakobPaulsson](https://github.com/JakobPaulsson)
* [niclasgardsuu](https://github.com/niclasgardsuu)
* [sgronlund](https://github.com/sgronlund)
---

# The Real Deal - Backend
![logo](./src/misc/Logo_white_with_blue_border_on_color.png)

This repository hosts the backend of our project, *The Real Deal*, written in [Node.js](https://nodejs.org/en/) which communication with our frontend application which can be found [here](https://github.com/sgronlund/latias-proj).


## First Time Usage

When you've successfully cloned this repo, enter the `src` folder and run
```
npm i
```
This installs all the dependencies this project requires.
This process should not differ from MacOS, Linux or Windows assuming you've successfully installed NodeJS on your host machine.

### Usage
To run the application run:
```bash
npm start
```

If everything is working your terminal should look something like this:
![image](https://user-images.githubusercontent.com/55285451/113585007-eaae8c80-962b-11eb-9f0c-616a5c71464e.png)

### Tests
To run tests, you can simply run:
```bash
npm test
```

### Documentation

To generate documentation, you can simply run:
```bash
npm run document
```

This will generate the `src/out/` folder where index.html will contain all generated documentation.

### Clean

To clean up temporary files or files that should not be committed, simply run:
```bash
npm run clean
```
