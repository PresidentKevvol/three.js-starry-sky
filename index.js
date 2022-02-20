// the code for 3D rendering

//an array for all the stars objects
var stars_objs = [];

//the three.js object group for the whole sky (all stars + milky way bg)
var sky_group;

//the floor (a group with a circle geometry)
var ground_group;
var ground_circle;

//the scene and the camera
var scene;
var camera;
var renderer;

//the texture loader
var textue_loader;
//the font loader
var font_loader;

//the sky sphere with the milky way as the background
var sky_texture;
var sky_sphere;

// the particles
var particles;
//ambient light
var amb_light;
//the hemisphere light
var hemi_light;

//the control for the camera
var controls;

//the latitude we're currently on (in degrees)
var cur_lat_deg = 32.18;
//corresping to this object rotation
var cur_rot_rad = lat2rot(cur_lat_deg);

//the speed at which the sky dome rotates
var rot_speed = 0.0005;

//convert a star's b-v temperature index to human eye color
function bv2rgb(bv){    // RGB <0,1> <- BV <-0.4,+2.0> [-]
    var t;  
    var r=0.0;
    var g=0.0;
    var b=0.0; 
    
    if (bv<-0.4) bv=-0.4; if (bv> 2.0) bv= 2.0;
    
         if ((bv>=-0.40)&&(bv<0.00)) { t=(bv+0.40)/(0.00+0.40); r=0.61+(0.11*t)+(0.1*t*t); }
    else if ((bv>= 0.00)&&(bv<0.40)) { t=(bv-0.00)/(0.40-0.00); r=0.83+(0.17*t)          ; }
    else if ((bv>= 0.40)&&(bv<2.10)) { t=(bv-0.40)/(2.10-0.40); r=1.00                   ; }
         if ((bv>=-0.40)&&(bv<0.00)) { t=(bv+0.40)/(0.00+0.40); g=0.70+(0.07*t)+(0.1*t*t); }
    else if ((bv>= 0.00)&&(bv<0.40)) { t=(bv-0.00)/(0.40-0.00); g=0.87+(0.11*t)          ; }
    else if ((bv>= 0.40)&&(bv<1.60)) { t=(bv-0.40)/(1.60-0.40); g=0.98-(0.16*t)          ; }
    else if ((bv>= 1.60)&&(bv<2.00)) { t=(bv-1.60)/(2.00-1.60); g=0.82         -(0.5*t*t); }
         if ((bv>=-0.40)&&(bv<0.40)) { t=(bv+0.40)/(0.40+0.40); b=1.00                   ; }
    else if ((bv>= 0.40)&&(bv<1.50)) { t=(bv-0.40)/(1.50-0.40); b=1.00-(0.47*t)+(0.1*t*t); }
    else if ((bv>= 1.50)&&(bv<1.94)) { t=(bv-1.50)/(1.94-1.50); b=0.63         -(0.6*t*t); }
    return [r, g, b];
}

//geo latitude to in program skydome rotation
function lat2rot (lat) {
    return (90 - lat) / 180 * Math.PI;
}

//the glsl code for the shaders
//vertex shader
var _VS = `
uniform vec3 baseColor;
uniform vec3 viewVector;

varying float intensity;
varying vec3 vertexNormal;
varying vec3 objPosition;

void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

    vertexNormal = normal;
    objPosition = normalize(1.0 * position);
    
    //vec3 vNormal = normalize( normalMatrix * normal );
    //vec3 vNormel = normalize( normalMatrix * viewVector );
    //intensity = pow( dot(vNormal, vNormel), 1.5 );

    //vec3 actual_normal = vec3(modelMatrix * vec4(normal, 0.0));
    //intensity = pow( dot(normalize(viewVector), actual_normal), 2.0 );
}
`;
//fragment shader
var _FS = `
uniform vec3 baseColor;
uniform vec3 starObjPosition;

varying float intensity;
varying vec3 vertexNormal;
varying vec3 objPosition;

void main() {
    //float colorIntensity = pow(0.5 - dot(vertexNormal, vec3(0.0, 1.0, 0.0)), 2.0);
    float colorIntensity = pow( - dot(vertexNormal, normalize(-1.0 * starObjPosition)), 2.0);
    //gl_FragColor = vec4( baseColor, 1.0 ) * colorIntensity;

    gl_FragColor = vec4( baseColor, colorIntensity );
}
`;

//for rendering the stars 
function load_stars() {
    //the catalog have a list of stars
    var starcat = stars_catalog["stars"];
    
    for (var ct = 0; ct < starcat.length; ct++) {
        var st = starcat[ct];
        
        //the stats of the star, angles are in radians
        //right ascension
        var ra = (parseFloat(st["RA"][0]) / 24 + parseFloat(st["RA"][1])  /  (24*60) + parseFloat(st["RA"][2]) / (24*60*60)  ) * 2 * Math.PI;
        //declination
        var de = (parseFloat(st["DE"][1]) / 360 + parseFloat(st["DE"][2]) / (360*60) + parseFloat(st["DE"][3]) / (360*60*60) ) * 2 * Math.PI;
        if (st["DE"][0] === "-") {// if -ve sign
            de = -de;
        }
        //visual magnitude (i.e. brightness)
        var vmag = parseFloat(st["vmag"]);
        
        //calculate the xyz coordinate of this star using modified spherical coordinate system
        //equations here: https://en.wikipedia.org/wiki/Equatorial_coordinate_system
        var sx = 10000 * Math.cos(de) * Math.cos(ra);
        var sy = 10000 * Math.cos(de) * Math.sin(ra);
        var sz = 10000 * Math.sin(de);
        
        if (isNaN(sx) || isNaN(sy) || isNaN(sz)) {
            console.log("star data missing/malformed: " + st["name"] + ": " + sx + ", " + sy + ", " + sz);
            continue;
        }
        
        //calculate the size (lower vmag -> brighter -> larger dot visually)
        //var osize = 60 * Math.pow(1.5, -vmag);
        var osize = 75 * Math.pow(1.35, Math.min(-vmag, 0.15));
        
        //get the color (from bv index)
        var bv = parseFloat(st["bv"]);
        var st_color = bv2rgb(bv);
        
        //create the model object
        var geometry = new THREE.SphereGeometry(osize, 18, 10);
        //var material = new THREE.MeshBasicMaterial({color: 0xffffff});
        var material = new THREE.ShaderMaterial({
            uniforms: {
                //base color of the star, could be set to various color later
                baseColor: {type: "c", value: new THREE.Color(st_color[0], st_color[1], st_color[2])},
                //the current position of the camera
                viewVector: { type: "v3", value: camera.position },
                //this star object's position vector within the universe(scene)
                starObjPosition: { type: "v3", value: new THREE.Color(sy, sz, sx) },
            },
            vertexShader: _VS,
            fragmentShader: _FS,
            blending: THREE.AdditiveBlending,
        });
        
        var star = new THREE.Mesh(geometry, material);
        
        //set position and add to scene
        star.position.x = sy;
        star.position.y = sz;
        star.position.z = sx;
        //scene.add(star);
        sky_group.add(star);
        stars_objs.push(star);
    }
}

function load_skysphere() {
    var skygeo = new THREE.SphereGeometry(14000, 96, 48);
    
    sky_texture = textue_loader.load("starmap_16k_d57.jpg");
    
    var material = new THREE.MeshPhongMaterial({ 
        map: sky_texture,
    });
    
    sky_sphere = new THREE.Mesh(skygeo, material);
    sky_sphere.material.side = THREE.BackSide;
    
    sky_sphere.rotateY(-Math.PI / 2);
    
    //scene.add(sky_sphere);
    sky_group.add(sky_sphere);
}

function load_ground() {
    var geom = new THREE.CylinderGeometry( 50, 50, 0.5, 8 );
    
    var grass_texture = textue_loader.load("grass_textures_seamless_36.jpg");
    grass_texture.wrapS = THREE.RepeatWrapping;
    grass_texture.wrapT = THREE.RepeatWrapping;
    grass_texture.repeat.set( 8, 8 );
    var mat = new THREE.MeshPhongMaterial({ map: grass_texture, });
    //var mat = new THREE.MeshStandardMaterial( { color: 0x144a09 } );
    ground_circle = new THREE.Mesh(geom, mat);

    ground_circle.position.y = -3;
    
    ground_group = new THREE.Group();
    ground_group.add(ground_circle);

    //now create the compass (N, E, S, W direction texts)
    var direction_N_geom;
    font_loader.load('helvetiker_regular.typeface.json', function(font) {
        direction_N_geom = new THREE.TextGeometry( 'N', {
		font: font,
		size: 40,
		height: 5,
		curveSegments: 12,
		bevelEnabled: true,
		bevelThickness: 35,
		bevelSize: 8,
		bevelOffset: 0,
		bevelSegments: 5
        });
    });
    
    var direction_N = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 11), new THREE.MeshStandardMaterial({color: 0xe84d4d }));
    var direction_E = new THREE.Mesh(new THREE.BoxGeometry(11, 0.03, 0.03), new THREE.MeshStandardMaterial({color: 0xa6a6a6 }));
    var direction_S = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 11), new THREE.MeshStandardMaterial({color: 0x3d5ccc }));
    var direction_W = new THREE.Mesh(new THREE.BoxGeometry(11, 0.03, 0.03), new THREE.MeshStandardMaterial({color: 0xa6a6a6 }));
    
    direction_N.position.z = 6;
    direction_E.position.x = 6;
    direction_S.position.z = -6;
    direction_W.position.x = -6;
    
    direction_N.position.y = -2.4;
    direction_E.position.y = -2.4;
    direction_S.position.y = -2.4;
    direction_W.position.y = -2.4;
    
    ground_group.add(direction_N);
    ground_group.add(direction_E);
    ground_group.add(direction_S);
    ground_group.add(direction_W);
    
    scene.add(ground_group);
}

//when the rotation speed slider is changed
function rot_speed_change (evnt) {
    var value = evnt.target.value;
    rot_speed = value / 10000;
}
//when the set lat button is pressed
function set_lat_pressed() {
    var value = document.getElementById("lat").value;

    //clamp to +-90
    if (value > 90) {
        value = 90;
    } else if (value < -90) {
        value = -90;
    }

    //the new rotation
    var new_rot = lat2rot(value);
    
    //calculate the differnce and rotate that amount
    var rot_diff = new_rot - cur_rot_rad;

    axis_polar.applyAxisAngle(unit_i, rot_diff);
    //sky_group.rotateOnAxis(unit_i, rot_diff);
    sky_group.rotateOnWorldAxis(unit_i, rot_diff);
    
    //update value
    cur_rot_rad = new_rot;
}

function indexjs_setup() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 15000);
    
    //create the loaders
    textue_loader = new THREE.TextureLoader();
    font_loader = new THREE.FontLoader();
    
    renderer = new THREE.WebGLRenderer({"antialias": true});
    renderer.setSize(window.innerWidth, window.innerHeight);
    //enable shadows
    renderer.shadowMap.enabled = true;
    //add to document
    document.body.appendChild(renderer.domElement);
    
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    //disable zooming and panning (can only look in different directions)
    controls.enablePan = false;
    controls.enableZoom = false;
    
    //an ambient light
    amb_light = new THREE.AmbientLight(0x909090);
    scene.add(amb_light);
    
    //the hemisphere light
    hemi_light = new THREE.HemisphereLight(0x21266e, 0x080820, 0.2);
    scene.add(hemi_light);
    
    //set camera position
    //camera.position.x = 1;
    //camera.lookAt(-1,0,0);
    camera.position.z = -0.01;

    
    //create the group object
    //the next functions will add objects to it
    sky_group = new THREE.Group();
    
    //load the stars
    load_stars();
    //load the milky way sky sphere
    load_skysphere();

    //add the objects to the scene
    scene.add(sky_group);
    
    //add the ground
    load_ground();

    //rotate whole sky dome to emulate earth on requested lattitude
    //sky_group.rotateOnAxis(unit_i, cur_rot_rad);
    sky_group.rotateOnWorldAxis(unit_i, cur_rot_rad);
    
    animate();
    
    //set the controls' event listener
    document.getElementById("rot-speed").addEventListener("input", rot_speed_change);
    document.getElementById("set-lat").addEventListener("click", set_lat_pressed);
}

// frame rate
var frames_per_sec = 60;

//the requested lattitude (default toronto, ON)
//var lat_in_rad = 43.75 / 180 * Math.PI;

var unit_i = new THREE.Vector3(1, 0, 0);
var unit_j = new THREE.Vector3(0, 1, 0);
var unit_k = new THREE.Vector3(0, 0, 1);

//vector pointing to north celestial pole
//this always rotate along with the sky group
var axis_polar = unit_j.clone();
axis_polar.applyAxisAngle(unit_i, cur_rot_rad);

function animate() {
    requestAnimationFrame(animate);
    
    //rotate the sky
    //sky_group.rotateOAxis(unit_j, -rot_speed);
    sky_group.rotateOnWorldAxis(axis_polar, -rot_speed);
    
    controls.update();
    
    
    renderer.render(scene, camera);
}

function window_resize() {
    renderer.setSize( window.innerWidth, window.innerHeight );
    camera.aspect = window.innerWidth / window.innerHeight;
}

document.addEventListener("DOMContentLoaded", indexjs_setup);
window.addEventListener('resize', window_resize);