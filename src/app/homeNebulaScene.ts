import * as THREE from "three";

// World-anchored, domain-warped 3D cloud fields: no tiled image, mirrored
// faces, or panorama seam. Each depth layer samples different world volumes.
export function createHomeNebulaScene(stage: HTMLElement) {
  const surface=stage.closest('.observatory-home')?.querySelector<HTMLElement>('.observatory-nebula');
  if(!surface)return null;
  const renderer=new THREE.WebGLRenderer({alpha:false,antialias:false});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.setClearColor('#091722');
  renderer.domElement.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
  surface.appendChild(renderer.domElement);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();
  const geometry=new THREE.SphereGeometry(1,48,32);
  const materials:THREE.ShaderMaterial[]=[];
  [36,24,16].forEach((radius,index)=>{
    const material=new THREE.ShaderMaterial({
      uniforms:{layer:{value:index},strength:{value:index===0?1:.19}},
      vertexShader:`varying vec3 world; void main(){vec4 p=modelMatrix*vec4(position,1.);world=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`,
      fragmentShader:`uniform float layer;uniform float strength;varying vec3 world;
        float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
        float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
          return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
          mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
        float fbm(vec3 p){return .57*noise(p)+.28*noise(p*2.07+vec3(17.3,4.1,9.2))+.15*noise(p*4.31+vec3(3.8,19.1,1.7));}
        void main(){
          vec3 p=world*.15+vec3(layer*7.31,layer*3.19,-layer*5.7);
          vec3 warp=vec3(noise(p+vec3(8,1,3)),noise(p+vec3(2,13,5)),noise(p+vec3(4,7,19)));
          vec3 q=p+warp*2.7;
          float clouds=fbm(q),filaments=pow(1.-abs(2.*fbm(q*2.6)-1.),5.);
          float density=smoothstep(.34,.76,clouds);
          float region=noise(p*.31+vec3(3,11,7));
          vec3 teal=vec3(.018,.087,.105),rose=vec3(.22,.057,.085),amber=vec3(.25,.12,.043);
          vec3 tint=mix(teal,rose,smoothstep(.26,.65,region));
          tint=mix(tint,amber,smoothstep(.61,.86,noise(p*.43+vec3(17,2,6))));
          vec3 c=vec3(.003,.008,.014)+tint*density*(.4+filaments*.8);
          gl_FragColor=vec4(c,strength*(layer<.5?1.:density*.65));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      side:THREE.BackSide,transparent:index>0,depthWrite:false,
    });
    materials.push(material);
    const shell=new THREE.Mesh(geometry,material);shell.scale.setScalar(radius);shell.renderOrder=index;scene.add(shell);
  });
  let width=0,height=0;
  return {
    render(source:THREE.PerspectiveCamera){
      const w=surface.clientWidth,h=surface.clientHeight;
      if(!w||!h||!stage.clientHeight)return;
      if(w!==width||h!==height){renderer.setSize(w,h,false);width=w;height=h;}
      // Same world pose and focal length as the brain, expanded to the full
      // Home viewport. The UI is deliberately outside both WebGL scenes.
      camera.position.copy(source.position);camera.quaternion.copy(source.quaternion);
      camera.aspect=w/h;camera.near=.1;camera.far=100;
      camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(source.fov/2))*h/stage.clientHeight));
      const rect=stage.getBoundingClientRect(),back=surface.getBoundingClientRect();
      camera.setViewOffset(w,h,(back.left+w/2)-(rect.left+rect.width/2),(back.top+h/2)-(rect.top+rect.height/2),w,h);
      camera.updateProjectionMatrix();renderer.render(scene,camera);
      renderer.domElement.dataset.camera=source.position.toArray().join(",");
      renderer.domElement.dataset.space="world-nebula";
    },
    dispose(){geometry.dispose();materials.forEach(m=>m.dispose());renderer.dispose();renderer.domElement.remove();},
  };
}
