// the code for 3D rendering

//an array for all the stars objects
var stars_objs = []

//the scene and the camera
var scene;
var camera;
var renderer;

// the particles
var particles;
//ambient light
var amb_light;
//the hemisphere light
var hemi_light;

//the control for the camera
var controls;

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
    gl_FragColor = vec4( baseColor, 1.0 ) * colorIntensity;
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
        var osize = 70 * Math.pow(1.5, -vmag);
        
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
        scene.add(star);
        stars_objs.push(star);
    }
}

function indexjs_setup() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 12000);
    
    renderer = new THREE.WebGLRenderer({"antialias": true});
    renderer.setSize(window.innerWidth, window.innerHeight);
    //enable shadows
    renderer.shadowMap.enabled = true;
    //add to document
    document.body.appendChild(renderer.domElement);
    
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    
    //an ambient light
    amb_light = new THREE.AmbientLight(0x909090);
    scene.add(amb_light);
    
    //the hemisphere light
    hemi_light = new THREE.HemisphereLight(0xffffbb, 0x080820, 0.8);
    scene.add(hemi_light);
    
    camera.position.z = 1;
    
    //load the stars
    load_stars();
    
    //add the skybox
    //load_skybox();
    
    animate();
}

// frame rate
var frames_per_sec = 60;

function animate() {
    requestAnimationFrame(animate);
    
    controls.update();
    
    renderer.render(scene, camera);
}

document.addEventListener("DOMContentLoaded", indexjs_setup);