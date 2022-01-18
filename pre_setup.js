/*
code for loading the images for and setting up the skybox
*/
var skybox1 = [
    'skybox/clouds1/clouds1_east.bmp',
    'skybox/clouds1/clouds1_west.bmp',
    'skybox/clouds1/clouds1_up.bmp',
    'skybox/clouds1/clouds1_down.bmp',
    'skybox/clouds1/clouds1_north.bmp',
    'skybox/clouds1/clouds1_south.bmp',
];
var skybox2 = [
    'skybox/Daylight Box_Pieces/Daylight Box_south.bmp',
    'skybox/Daylight Box_Pieces/Daylight Box_north.bmp',
    'skybox/Daylight Box_Pieces/Daylight Box_up.bmp',
    'skybox/Daylight Box_Pieces/Daylight Box_down.bmp',
    'skybox/Daylight Box_Pieces/Daylight Box_east.bmp',
    'skybox/Daylight Box_Pieces/Daylight Box_west.bmp',
];

//function for loading the sky box
function load_skybox() {
    loader = new THREE.CubeTextureLoader();
    texture = loader.load(skybox2);
    scene.background = texture;
}