/**
 * @license
 * Copyright (c) 2017 Google Inc. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * Code distributed by Google as part of this project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
'use strict';

import assert from '../platform/assert-web.js';
import DomParticle from './dom-particle.js';

// Regex to separate style and template.
let re = /<style>((?:.|[\r\n])*)<\/style>((?:.|[\r\n])*)/;

/** @class TransformationDomParticle
 * Particle that does transformation stuff with DOM.
 */
class TransformationDomParticle extends DomParticle {
  getTemplate(slotName) {
    return this._state.template;
  }
  _render(props, state) {
    return state.renderModel;
  }
  _shouldRender(props, state) {
    return Boolean(state.template && state.renderModel);
  }

  renderHostedSlot(slotName, hostedSlotId, content) {
    this.combineHostedTemplate(slotName, hostedSlotId, content);
    this.combineHostedModel(slotName, hostedSlotId, content);
  }

  // abstract
  combineHostedTemplate(slotName, hostedSlotId, content) {}
  combineHostedModel(slotName, hostedSlotId, content) {}

  // Helper methods that may be reused in transformation particles to combine hosted content.
  static combineTemplates(transformationTemplate, hostedTemplate) {
    let transformationMatch = transformationTemplate.match(re);
    if (!transformationMatch || transformationMatch.length != 3) {
      return;
    }
    let hostedMatch = hostedTemplate.match(re);
    if (!hostedMatch || hostedMatch.length != 3) {
      return;
    }

    return `
      <style>${transformationMatch[1].trim()}${hostedMatch[1].trim()}</style>
      ${transformationMatch[2].trim().replace('{{hostedParticle}}', hostedMatch[2].trim())}
    `;
  }
  static propsToItems(propsValues) {
    return propsValues ? propsValues.map(({rawData, id}) => Object.assign({}, rawData, {subId: id})) : [];
  }
}

export default TransformationDomParticle;
