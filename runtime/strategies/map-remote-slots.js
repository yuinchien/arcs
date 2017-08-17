// Copyright (c) 2017 Google Inc. All rights reserved.
// This code may only be used under the BSD style license found at
// http://polymer.github.io/LICENSE.txt
// Code distributed by Google as part of this project is also
// subject to an additional IP rights grant found at
// http://polymer.github.io/PATENTS.txt

let {Strategy} = require('../../strategizer/strategizer.js');
let Recipe = require('../recipe/recipe.js');
let RecipeWalker = require('../recipe/walker.js');
let RecipeUtil = require('../recipe/recipe-util.js');

class MapRemoteSlots extends Strategy {
  constructor(arc, context) {
    // faked out for now
    super();
    this.remoteSlots = arc.pec.slotComposer ? arc.pec.slotComposer.getAvailableSlots() : {};
  }
  async generate(strategizer) {
    var remoteSlots = this.remoteSlots;
    var results = Recipe.over(strategizer.generated, new class extends RecipeWalker {
      onSlotConnection(recipe, slotConnection) {
        if (slotConnection.targetSlot)
          return;
        if (remoteSlots[slotConnection.name] == undefined)
          return;
        // TODO: remoteSlots should also contain and verify view-connections of the provided slot
        var score = 1 - remoteSlots[slotConnection.name].count;
        return (recipe, slotConnection) => {
          let slot = recipe.newSlot(slotConnection.name);
          slot.id = remoteSlots[slotConnection.name].id;
          slotConnection.connectToSlot(slot);
          return score;
        }
      }
    }(RecipeWalker.Permuted), this);

    return { results, generate: null };
  }
}

module.exports = MapRemoteSlots;