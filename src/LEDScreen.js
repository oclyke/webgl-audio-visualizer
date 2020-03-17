// This component uses webgl to render a preview of the LED device

import React from 'react';
import styled from 'styled-components';

var color_convert = require('color-convert');

function createShader(gl, type, source){
  var shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (success) {
    return shader;
  }
  console.log(gl.getShaderInfoLog(shader));
  gl.deleteShader(shader);
}

function createProgram(gl, vertexShader, fragmentShader){
  var program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  var success = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (success) {
    return program;
  }
 
  console.log(gl.getProgramInfoLog(program));
  gl.deleteProgram(program);
}

const LEDScreenContainer = styled.div`
  width: 100%;
  height: 100%;
`
class LEDScreen extends React.Component {
  constructor(props){
    super(props)

    this.setUpWebGL = () => {
      var canvas = this.canvas.current;
      this.gl = canvas.getContext('webgl');

      this.grid = {
        width: 21,
        height: 13,
      }
      // this.grid = {
      //   width: 21,
      //   height: 13,
      // }
      this.num_leds = this.grid.width * this.grid.height;


      // generate gl info
      this.gl_info = (() => { 
        const num_leds = this.num_leds;
        var info = {
          bridge: {
            a_position: {size: 2, type: this.gl.FLOAT, normalize: 0, stride: 0, offset: 0},
            u_resolution: {},
            u_num_leds: {},
            u_led_pos: {vec_size: 3, arr_len: num_leds},
            u_led_col: {vec_size: 4, arr_len: num_leds},
          },
          get v_shader_src() { return `
            attribute vec4 a_position;
            void main() {
              gl_Position = a_position;
            }
          `},
          get f_shader_src() { return `
            precision highp float;

            #define NUM_LEDS ${num_leds}

            uniform vec2 u_resolution;
            uniform vec3 u_led_pos[NUM_LEDS];
            uniform vec4 u_led_col[NUM_LEDS];
          
            void main() {
              vec3 light = vec3(0.0);
              vec3 pos = vec3(vec2(gl_FragCoord.x, gl_FragCoord.y) / u_resolution, 0.0);
              
              for( int i = 0; i < NUM_LEDS; i++ ){ // get contributions from *every* led (it is V hard to access arrays by a non-'constant' index in OpenGL (and in OpenGL that means anything that's not a loot iterator))

                // Determine if we will even consider this led (fail early to save processing time?)
                float r = length(u_led_pos[i] - pos); 
                // float roi = 0.1; // radius of influence
                float roi = 0.08; // radius of influence

                if(r <= 2.0 * roi){ // only consider leds that are within 2 roi of the pixel
              
                  ///////////////////
                  // Get Contribution
                  ///////////////////
                  vec3 contribution = vec3(0.0);
                  float level = 0.0;
                  float pi = 3.14159265359;

                  if(r == 0.0){
                    level = 1.0;
                  }else{
                    float f = pi * r / roi;
                    level = pow(sin(f)/f, 2.0);
                  }

                  if(level >= 0.0){
                    contribution = vec3(u_led_col[i].x, u_led_col[i].y, u_led_col[i].z) * level ;
                  }

                  // todo: perhaps adjust contribution to be subracting from white? (so that LEDs off shows a white screen)

                  ////////////////////
                  // Sum contributions
                  ////////////////////
                  light += contribution; // consider every led's contribution

                }
              }

              gl_FragColor = vec4(light, 1.0);
            }
          `},
        }
        console.log(info);
        return info;
      })();
  
      this.gl_info.v_shader = createShader(this.gl, this.gl.VERTEX_SHADER, this.gl_info.v_shader_src);
      this.gl_info.f_shader = createShader(this.gl, this.gl.FRAGMENT_SHADER, this.gl_info.f_shader_src);
      this.gl_info.program = createProgram(this.gl, this.gl_info.v_shader, this.gl_info.f_shader);

      // position buffer (we basically just want to create one surface that covers the whole canvas)
      this.gl_info.bridge.a_position.location = this.gl.getAttribLocation(this.gl_info.program, 'a_position');
      this.gl_info.bridge.a_position.buffer = this.gl.createBuffer();
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.gl_info.bridge.a_position.buffer);
      // three 2d points
      var positions = [
        -1, -1,
        1, -1,
        -1, 1,
        -1, 1,
        1, -1,
        1, 1,
      ];
      this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.STATIC_DRAW);

      // Resolution
      this.gl_info.bridge.u_resolution.location = this.gl.getUniformLocation(this.gl_info.program, "u_resolution");

      // Number of leds
      this.gl_info.bridge.u_num_leds.location = this.gl.getUniformLocation(this.gl_info.program, 'u_num_leds');

      // LED postions 
      this.gl_info.bridge.u_led_pos.location = this.gl.getUniformLocation(this.gl_info.program, 'u_led_pos');
      this.gl_info.bridge.u_led_pos.buffer = new Float32Array(this.num_leds * this.gl_info.bridge.u_led_pos.vec_size);
      
      // LED colors
      this.gl_info.bridge.u_led_col.location = this.gl.getUniformLocation(this.gl_info.program, 'u_led_col');
      this.gl_info.bridge.u_led_col.buffer = new Float32Array(this.num_leds * this.gl_info.bridge.u_led_col.vec_size);

      // Initialize LED positions and colors
      var led = this.num_leds;
      while(led--){
        const row = Math.floor(led/this.grid.width);
        const column = led % this.grid.width;

        // positions
        const color_to_edge = false;
        const pos_idx = led * this.gl_info.bridge.u_led_pos.vec_size;
        this.gl_info.bridge.u_led_pos.buffer[pos_idx + 0] = 1/(this.grid.width + ((color_to_edge) ? -1 : 1)) * (column + ((color_to_edge) ? 0 : 1));
        this.gl_info.bridge.u_led_pos.buffer[pos_idx + 1] = 1/(this.grid.height + ((color_to_edge) ? -1 : 1)) * (row + ((color_to_edge) ? 0 : 1));
        this.gl_info.bridge.u_led_pos.buffer[pos_idx + 2] = 0.0;

        // colors
        const col_idx = led * this.gl_info.bridge.u_led_col.vec_size;
        this.gl_info.bridge.u_led_col.buffer[col_idx + 0] = 1/(this.grid.width + 1) * (column + 1);
        this.gl_info.bridge.u_led_col.buffer[col_idx + 1] = 0.0
        this.gl_info.bridge.u_led_col.buffer[col_idx + 2] = 1/(this.grid.height + 1) * (row + 1);
        this.gl_info.bridge.u_led_col.buffer[col_idx + 3] = 1.0;
      }
    }

    this.redraw = () => {
      if((typeof(this.gl_info) === 'undefined') || (this.gl_info === null)){ return; }

      // Tell it to use our program (pair of shaders)
      this.gl.useProgram(this.gl_info.program);
      
      // Set up the position attribute
      var a_position = this.gl_info.bridge.a_position;
      this.gl.enableVertexAttribArray(a_position.location);
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, a_position.buffer);
      this.gl.vertexAttribPointer(a_position.location, a_position.size, a_position.type, a_position.normalize, a_position.stride, a_position.offset);

      // pass along canvas size to the resolution variable
      this.gl.uniform2f(this.gl_info.bridge.u_resolution.location, this.gl.canvas.width, this.gl.canvas.height);

      // pass along led info
      this.gl.uniform3fv(this.gl_info.bridge.u_led_pos.location, this.gl_info.bridge.u_led_pos.buffer, 0, this.num_leds * this.gl_info.bridge.u_led_pos.vec_size);
      this.gl.uniform4fv(this.gl_info.bridge.u_led_col.location, this.gl_info.bridge.u_led_col.buffer, 0, this.num_leds * this.gl_info.bridge.u_led_col.vec_size);

      var primitiveType = this.gl.TRIANGLES;
      var offset = 0;
      var count = 6;
      this.gl.drawArrays(primitiveType, offset, count);
    }

    this.updateSize = () => {
      // get the new dimensions
      // - note - 
      // https://developer.mozilla.org/en-US/docs/Web/API/Window/outerWidth
      // https://developer.mozilla.org/en-US/docs/Web/API/Window/innerWidth
      // previously used 'inner' values (innerWidth and innerHeight), but this causes strange behavior
      // need to investigate more - are 'outer' values going to be appropriate across all devices / browsers?
      // JK - 'outer' values are bad - on chrome they include the entire top bar
      // now 'inner' values seem to work fine. perhaps this is just a bug with chrome dev tools 'responsive' device emulator
      var width = window.innerWidth;
      var height = window.innerHeight;

      this.setState((state, props) => { 
        return {
          width: width,
          height: height,
        }
      });

      // do stuff to the canvas?
      var canvas = this.canvas.current;
      
      // changing canvas size resets the canvas
      canvas.width = width;
      canvas.height = height;

      // update the gl viewport
      if((typeof(this.gl) !== 'undefined') && (this.gl !== null)){
        this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
      }
      
      // redraw the desired output
      this.redraw();
    };

    // audio
    this.handleAudio = (stream) => {
      console.log(stream);

      const context = new AudioContext();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();

      analyser.minDecibels = -90;
      analyser.maxDecibels = -10;
      analyser.smoothingTimeConstant = 0.85;
      analyser.fftSize = 32;
      const dataArrayLength = analyser.frequencyBinCount;
      var dataArray = new Uint8Array(dataArrayLength);
      analyser.getByteTimeDomainData(dataArray);

      var interpolatedArray = new Uint8Array(20); // 20 is how many bins Andy's device calculates

      source.connect(analyser);

      var waterfall_prev_timestamp = 0;

      var showFFTData = (timestamp) => {
        if(this.state.run){
          requestAnimationFrame(showFFTData);
        }

        // // get analyser data
        // analyser.getByteTimeDomainData(dataArray); // this is time domain data... good for drawing the waveform
        analyser.getByteFrequencyData(dataArray); // this is frequency domain data... good for drawing component strength bins

        const mode = 'waterfall';
        switch(mode){
          case 'sinusoids':
            var led = this.num_leds;
            while(led--){
              const row = Math.floor(led/this.grid.width);
              const column = led % this.grid.width;

              const col_idx = led * this.gl_info.bridge.u_led_col.vec_size;
              this.gl_info.bridge.u_led_col.buffer[col_idx + 0] = 0.5*(Math.sin(2*Math.PI*timestamp/3000 + (2*Math.PI * (row / this.grid.height))) + 1);
              this.gl_info.bridge.u_led_col.buffer[col_idx + 2] = 0.5*(Math.cos(2*Math.PI*timestamp/3000 + (2*Math.PI * (column / this.grid.width))) + 1);
            }
            break;

          case 'waterfall':

            function interpArray(from, to, method){
              for( var idx = 0; idx < to.length; idx++ ){
                const sample_location = (idx / (to.length - 1)) * from.length;
                to[idx] = method(from, sample_location);
              }
            }

            function linearInterp(from, sample_location){
              const delta = sample_location % 1;
              const y1 = from[sample_location - delta];
              const y2 = (sample_location - delta >= from.length) ? from[from.length] : from[sample_location - delta + 1];
              return (delta*y2 + y1*(1-delta));
            }

            interpArray(dataArray, interpolatedArray, linearInterp); // the interpolated array corresponds more or less to Andy's FFT data


            // if(timestamp - waterfall_prev_timestamp >= 50){ // number of ms per row shift
              waterfall_prev_timestamp = timestamp;

              for( var y_idx = this.grid.height - 2; y_idx >= 0; y_idx-- ){
                var byte_idx = 4*this.grid.width;
                while(byte_idx--){
                  this.gl_info.bridge.u_led_col.buffer[this.grid.width*4*(y_idx+1) + byte_idx] = this.gl_info.bridge.u_led_col.buffer[this.grid.width*4*(y_idx) + byte_idx];
                }
              }
            // }

            // put fft values in the bottom row
            for( var x_idx = 0; x_idx < this.grid.width; x_idx++ ){
              const col_idx = 4*x_idx;

              var RGB = color_convert.hsv.rgb(360*(x_idx/this.grid.width), 100, 100);

              const exposure = 0.6 + (x_idx/this.grid.width - 1) * 0.4;
              const strength = exposure * (linearInterp(dataArray, (x_idx/(this.grid.width+1)*dataArrayLength))/255);

              this.gl_info.bridge.u_led_col.buffer[col_idx + 0] = strength * (RGB[0]/255);
              this.gl_info.bridge.u_led_col.buffer[col_idx + 1] = strength * (RGB[1]/255);
              this.gl_info.bridge.u_led_col.buffer[col_idx + 2] = strength * (RGB[2]/255);
            
            
            }




            

            break;

          default:
            break;
        }

        this.redraw();
      };

      showFFTData();
    };


    // led patterns



    this.update = (timestamp) => {
      // console.log(timestamp);
    }

    // refs
    this.canvas = React.createRef();

    // state
    this.state = {
      width: null,
      height: null,
      run: (typeof(props.run) === 'undefined') ? true : props.run,
    };
  }
  componentDidMount(){
    window.addEventListener('resize', this.updateSize);
    navigator.mediaDevices.getUserMedia({ audio: true, video: false }) // todo: make sure this popup comes at an appropriate time!
    .then(this.handleAudio);

    this.updateSize();
    this.setUpWebGL();
    this.redraw();

    // requestAnimationFrame(this.update);
  }
  componentWillUnmount(){
    window.removeEventListener('resize', this.updateSize);
  }
  componentDidUpdate(prevProps, prevState, snapshot){
    // console.log('component did update!');
    // console.log(this.props);

    if(this.props.run !== prevProps.run){ this.setState({run: this.props.run}); }

    this.expression = this.props.expression;
    // console.log('led screen\'s expression:', this.expression);
  }
  
  render(){
    return (
      <LEDScreenContainer>
        <canvas ref={this.canvas} id={'tbd'}/>
      </LEDScreenContainer>
    );
  }
}

export default LEDScreen;