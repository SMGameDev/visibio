// import _ from 'underscore'
// import Two from 'two.js'
// import $ from 'jquery'
//
// let two = null;
// let $stage = $('#stage');
//
// function initializeGame(renderTarget) {
//   _.each(Two.Instances, function (two) {
//     Two.Utils.release(two);
//     $(two.renderer.domElement).remove();
//   });
//   Two.Instances.length = 0;
//
//   two = new Two({
//     type: Two.Types[type],
//     autostart: false,
//     fullscreen: true
//   }).appendTo($stage[0]);
//
// }

import Game from './game.js';
import Renderer from './renderer.js';
import $ from 'jquery'

let game = new Game('ws://localhost:8080/');
$(document).ready(() => {
  let renderer = new Renderer(game);
});