import React from 'react';
import styled from 'styled-components';

import LEDScreen from './LEDScreen';

// Index.html notes
//   Since this is a guide for how to do the layout on the real app I must 
//   also make note of some things to check. 
//   - According to Google's responsive web design page (https://developers.google.com/web/fundamentals/design-and-ux/responsive)
//     we should make sure that a 'meta' tag like this: <meta name="viewport" content="width=device-width, initial-scale=1" /> 
//     exists in the <head> of the page. 

// CSS Media Queries ()
const size = {
  mobileS: '320px',
  mobileM: '375px',
  mobileL: '425px',
  tablet: '768px',
  laptop: '1024px',
  laptopL: '1440px',
  desktop: '2560px'
}

const device = {
  mobileS: `(min-width: ${size.mobileS})`,
  mobileM: `(min-width: ${size.mobileM})`,
  mobileL: `(min-width: ${size.mobileL})`,
  tablet: `(min-width: ${size.tablet})`,
  laptop: `(min-width: ${size.laptop})`,
  laptopL: `(min-width: ${size.laptopL})`,
  desktop: `(min-width: ${size.desktop})`,
  desktopL: `(min-width: ${size.desktop})`
};

// Fence
//   The fence is the outermost boundary of the app. 
//   It defines the overall size/shape
const Fence = styled.div`
  width: 100%;                    // take up full width of viewport
  height: 100%;
  background-color: grey;

  // Here are some examples of how styling can occur with CSS media queries based on common device sizes
  @media ${device.mobileS} {
    // // max-width: 300px;
    // background-color: red;
  }
  @media ${device.tablet} {
    // // max-width: 400px;
    // background-color: green;
  }
  @media ${device.laptop} {
    // // max-width: 800;
    // background-color: blue;
  }
`

class App extends React.Component {
  constructor(props){
    super(props);

    this.state = {
      run_ledscreen: true,
    };
  }

  render(){
    return (
      <Fence>
        <LEDScreen run={this.state.run_ledscreen} expression={this.expression}/>
      </Fence>
    );
  }
}

export default App;
