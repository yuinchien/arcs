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
import Slot from './slot.js';
import DomSlot from './dom-slot.js';
import {DomContext} from './dom-context.js';
import DescriptionDomFormatter from './description-dom-formatter.js';

class SlotComposer {
  constructor(options) {
    assert(options.affordance, 'Affordance is mandatory');
    assert(options.rootContext, 'Root context is mandatory');

    this._containerKind = options.containerKind;
    this._affordance = options.affordance;
    this._slotClass = this.getSlotClass();
    assert(this._slotClass);

    let slotContextByName = this._slotClass.findRootSlots(options.rootContext) || {};
    if (Object.keys(slotContextByName).length == 0) {
      // fallback to single 'root' slot using the rootContext.
      slotContextByName['root'] = options.rootContext;
    }

    this._suggestionsContext = options.suggestionsContext || slotContextByName['suggestions'];

    this._contextSlots = [];
    Object.keys(slotContextByName).forEach(slotName => {
      this._contextSlots.push({id: `rootslotid-${slotName}`, name: slotName, tags: [`#${slotName}`], context: slotContextByName[slotName], handleConnections: [], views: 0, getProvidedSlotSpec: () => { return {isSet: false}; }});
    });

    this._slots = [];
  }
  get affordance() { return this._affordance; }
  getSlotClass() {
    switch (this._affordance) {
      case 'dom':
      case 'dom-touch':
      case 'vr':
        return DomSlot;
      case 'mock':
        return Slot;
      default:
        assert('unsupported affordance ', this._affordance);
    }
  }
  _getSuggestionContext() {
    switch (this._affordance) {
      case 'dom':
      case 'dom-touch':
      case 'vr':
        return DomContext;
      default:
        assert('unsupported affordance ', this._affordance);
    }
  }
  _getDescriptionFormatter() {
    switch (this._affordance) {
      case 'dom':
      case 'dom-touch':
      case 'vr':
        return DescriptionDomFormatter;
      default:
        assert('unsupported affordance ', this._affordance);
    }
  }

  async setSuggestions(suggestions) {
    // TODO(mmandlis): slot composer should not be familiar with suggestions concept - they should just be slots.
    if (!this._suggestionsContext) {
      return;
    }

    this._suggestionsContext.textContent = '';

    suggestions.forEach(async suggestion => {
      let suggestionContent =
        await suggestion.description.getRecipeSuggestion(this._getDescriptionFormatter());

      if (!suggestionContent) {
        suggestionContent = 'No suggestion content was generated (unnamed recipe and no describable particles)';
      }

      this._getSuggestionContext().createContext(
          this.createSuggestionElement(this._suggestionsContext, suggestion),
          suggestionContent
      );
    });
  }

  createSuggestionElement(container, plan) {
    let suggest = Object.assign(document.createElement('suggestion-element'), {plan});
    // TODO(sjmiles): LIFO is weird, iterate top-down elsewhere?
    container.insertBefore(suggest, container.firstElementChild);
    return suggest;
  }

  getSlot(particle, slotName) {
    return this._slots.find(s => s.consumeConn.particle == particle && s.consumeConn.name == slotName);
  }

  _findContext(slotId) {
    let contextSlot = this._contextSlots.find(slot => slot.id == slotId);
    if (contextSlot) {
      return contextSlot.context;
    }
  }

  createHostedSlot(transformationParticle, transformationSlotName, hostedParticleName, hostedSlotName) {
    let hostedSlotId = this.arc.generateID();

    let transformationSlot = this.getSlot(transformationParticle, transformationSlotName);
    assert(transformationSlot,
           `Unexpected transformation slot particle ${transformationParticle.name}:${transformationSlotName}, hosted particle ${hostedParticleName}, slot name ${hostedSlotName}`);
    transformationSlot.addHostedSlot(hostedSlotId, hostedParticleName, hostedSlotName);
    return hostedSlotId;
  }
  _findSlotByHostedSlotId(hostedSlotId) {
    for (let slot of this._slots) {
      let hostedSlot = slot.getHostedSlot(hostedSlotId);
      if (hostedSlot) {
        return slot;
      }
    }
  }
  findHostedSlot(hostedParticle, hostedSlotName) {
    for (let slot of this._slots) {
      let hostedSlot = slot.findHostedSlot(hostedParticle, hostedSlotName);
      if (hostedSlot) {
        return hostedSlot;
      }
    }
  }

  initializeRecipe(recipeParticles) {
    let newSlots = [];
    // Create slots for each of the recipe's particles slot connections.
    recipeParticles.forEach(p => {
      Object.values(p.consumedSlotConnections).forEach(cs => {
        if (!cs.targetSlot) {
          assert(!cs.slotSpec.isRequired, `No target slot for particle's ${p.name} required consumed slot: ${cs.name}.`);
          return;
        }

        if (this._initHostedSlot(cs.targetSlot.id, p)) {
          // Skip slot creation for hosted slots.
          return;
        }

        let slot = new this._slotClass(cs, this.arc, this._containerKind);
        slot.startRenderCallback = this.arc.pec.startRender.bind(this.arc.pec);
        slot.stopRenderCallback = this.arc.pec.stopRender.bind(this.arc.pec);
        slot.innerSlotsUpdateCallback = this.updateInnerSlots.bind(this);
        newSlots.push(slot);
      });
    });

    // Attempt to set context for each of the slots.
    newSlots.forEach(s => {
      assert(!s.getContext(), `Unexpected context in new slot`);

      let context = null;
      let sourceConnection = s.consumeConn.targetSlot && s.consumeConn.targetSlot.sourceConnection;
      if (sourceConnection) {
        let sourceConnSlot = this.getSlot(sourceConnection.particle, sourceConnection.name);
        if (sourceConnSlot) {
          context = sourceConnSlot.getInnerContext(s.consumeConn.name);
        }
      } else { // External slots provided at SlotComposer ctor (eg 'root')
        context = this._findContext(s.consumeConn.targetSlot.id);
      }

      this._slots.push(s);

      if (context) {
        s.updateContext(context);
      }
    });
  }

  _initHostedSlot(hostedSlotId, hostedParticle) {
    let transformationSlot = this._findSlotByHostedSlotId(hostedSlotId);
    if (!transformationSlot) {
      return false;
    }
    transformationSlot.initHostedSlot(hostedSlotId, hostedParticle);
    return true;
  }

  async renderSlot(particle, slotName, content) {
    let slot = this.getSlot(particle, slotName);
    if (slot) {
      // Set the slot's new content.
      await slot.setContent(content, eventlet => {
        this.arc.pec.sendEvent(particle, slotName, eventlet);
      });
      return;
    }

    if (this._renderHostedSlot(particle, slotName, content)) {
      return;
    }

    assert(slot, `Cannot find slot (or hosted slot) ${slotName} for particle ${particle.name}`);
  }

  _renderHostedSlot(particle, slotName, content) {
    let hostedSlot = this.findHostedSlot(particle, slotName);
    if (!hostedSlot) {
      return false;
    }
    let transformationSlot = this._findSlotByHostedSlotId(hostedSlot.slotId);
    assert(transformationSlot, `No transformation slot found for ${hostedSlot.slotId}`);

    this.arc.pec.innerArcRender(transformationSlot.consumeConn.particle, transformationSlot.consumeConn.name, hostedSlot.slotId, content);

    return true;
  }

  updateInnerSlots(slot) {
    assert(slot, 'Cannot update inner slots of null');
    // Update provided slot contexts.
    Object.keys(slot.consumeConn.providedSlots).forEach(providedSlotName => {
      let providedContext = slot.getInnerContext(providedSlotName);
      let providedSlot = slot.consumeConn.providedSlots[providedSlotName];
      providedSlot.consumeConnections.forEach(cc => {
        // This will trigger 'start' or 'stop' render, if applicable.
        this.getSlot(cc.particle, cc.name).updateContext(providedContext);
      });
    });
  }

  getAvailableSlots() {
    let availableSlots = this.arc.activeRecipe.slots.slice();

    this._contextSlots.forEach(contextSlot => {
      if (!availableSlots.find(s => s.id == contextSlot.id)) {
        availableSlots.push(contextSlot);
      }
    });
    return availableSlots;
  }
}

export default SlotComposer;
