# Simple Face Recognition App

This is a simple real-time face recognition application built with [Vite](https://vitejs.dev/) + [React](https://reactjs.org/) and [face-api.js](https://github.com/justadudewhohacks/face-api.js). Designed for continuous face recognition without user intervention, it is ideal for automated attendance systems.

# Features
* **Real-Time Face Recognition**: Automatically recognizes faces without the need for user interaction.

* **No Server or Database Required**: All face recognition functionality is handled client-side.

# Getting Started

## Prerequisites
* Node.js installed
* npm or yarn package manager

## Installation
Clone the repository:
```bash
git clone https://github.com/noob210/simple-face-recognition.git
```

Navigate to the project directory:
```bash
cd simple-face-recognition
```

Install dependencies:
```bash
npm install
```
or

```bash
yarn install
```

## Running the App
Start the development server:

```bash
npm run dev
```
or

```bash
yarn dev
```
Open your browser and go to ***`http://localhost:3000`***.

# Usage
To configure the faces you want to be recognized, follow these steps:

1. Go to the ***`public/faces`*** directory.
2. Store the images of the faces you want to recognize in this directory. The filename of each image will serve as the label for that face, and this label will be displayed when the face is detected.
3. Open ***`src/components/getLabels.js`*** and edit the list of labels.

![screenshot](https://github.com/noob210/simple-face-recognition/blob/main/public/screenshot/screenshot.png)

## Supported Image Formats
By default, the app only recognizes PNG format images. You can change this setting to support other image formats by modifying the **`IMG_FORMAT`** variable in ***`src/components/config.js`***:

```javascript
export const IMG_FORMAT = 'png';
```

# Recommendations
If you intend to develop an attendance system or any similar application, it is recommended to use an **ID number** instead of names for each face. This helps to avoid duplication of names and related errors.

# Built With
1. [Vite](https://vitejs.dev/)
2. [React](https://reactjs.org/)
3. [face-api.js](https://github.com/justadudewhohacks/face-api.js)

# Attribution
1. Jane [Image](https://www.freepik.com/free-photo/lifestyle-people-emotions-casual-concept-confident-nice-smiling-asian-woman-cross-arms-chest-confident-ready-help-listening-coworkers-taking-part-conversation_17096951.htm#fromView=search&page=1&position=0&uuid=d26d6360-8834-4568-a76f-efb7c16ba855) by benzoix on Freepik
2. John [Image](https://www.freepik.com/free-photo/happy-business-man-wearing-grey-suit-standing-isolated-white-wall_12098163.htm#fromView=search&page=1&position=4&uuid=d26d6360-8834-4568-a76f-efb7c16ba855) Image by diana.grytsku on Freepik

# Contact
You can contact me at ***marvin.programming210@gmail.com*** if you have any comments or suggestions.

# License

This project is licensed under the [MIT](https://choosealicense.com/licenses/mit/)
