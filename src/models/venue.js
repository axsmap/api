const mongoose = require('mongoose');

const venueSchema = new mongoose.Schema(
  {
    //new expanded fields
    hasPermanentRamp: {
      yes: {
        type: Number,
        default: 0
      },
      no: {
        type: Number,
        default: 0
      }
    },
    hasPortableRamp: {
      yes: {
        type: Number,
        default: 0
      },
      no: {
        type: Number,
        default: 0
      }
    },
    hasWideEntrance: {
      yes: {
        type: Number,
        default: 0
      },
      no: {
        type: Number,
        default: 0
      }
    },
    hasAccessibleTableHeight: {
      yes: {
        type: Number,
        default: 0
      },
      no: {
        type: Number,
        default: 0
      }
    },
    hasAccessibleElevator: {
      yes: {
        type: Number,
        default: 0
      },
      no: {
        type: Number,
        default: 0
      }
    },
    hasInteriorRamp: {
      yes: {
        type: Number,
        default: 0
      },
      no: {
        type: Number,
        default: 0
      }
    },
    hasSwingInDoor: {
      yes: {
        type: Number,
        default: 0
      },
      no: {
        type: Number,
        default: 0
      }
    },
    hasSwingOutDoor: {
      yes: {
        type: Number,
        default: 0
      },
      no: {
        type: Number,
        default: 0
      }
    },
    hasLargeStall: {
      yes: {
        type: Number,
        default: 0
      },
      no: {
        type: Number,
        default: 0
      }
    },
    hasSupportAroundToilet: {
      yes: {
        type: Number,
        default: 0
      },
      no: {
        type: Number,
        default: 0
      }
    },
    hasLoweredSinks: {
      yes: {
        type: Number,
        default: 0
      },
      no: {
        type: Number,
        default: 0
      }
    },
    interiorScore: {
      type: Number
      //max: [7, 'Should be less than 8'],
      //min: [1, 'Should be more than 0']
    },

    //original fields
    address: {
      type: String,
      maxlength: [255, 'Should be less than 256 characters']
    },
    allowsGuideDog: {
      yes: {
        type: Number,
        default: 0
      },
      no: {
        type: Number,
        default: 0
      }
    },
    bathroomReviews: {
      type: Number,
      default: 0
      //min: [0, 'Should be more than 1']
    },
    bathroomScore: {
      type: Number
      //max: [4, 'Should be less than 5'],
      //min: [1, 'Should be more than 0']
    },
    entryReviews: {
      type: Number,
      default: 0
      //min: [0, 'Should be more than -1']
    },
    entryScore: {
      type: Number
      //max: [9, 'Should be less than 10'],
      //min: [1, 'Should be more than 0']
    },
    hasParking: {
      yes: {
        type: Number,
        default: 0
      },
      no: {
        type: Number,
        default: 0
      }
    },
    hasSecondEntry: {
      yes: {
        type: Number,
        default: 0
      },
      no: {
        type: Number,
        default: 0
      }
    },
    hasWellLit: {
      yes: {
        type: Number,
        default: 0
      },
      no: {
        type: Number,
        default: 0
      }
    },
    isArchived: {
      type: Boolean,
      default: false,
      required: [true, 'Is required']
    },
    isQuiet: {
      yes: {
        type: Number,
        default: 0
      },
      no: {
        type: Number,
        default: 0
      }
    },
    isSpacious: {
      yes: {
        type: Number,
        default: 0
      },
      no: {
        type: Number,
        default: 0
      }
    },
    location: {
      type: {
        type: String,
        default: 'Point'
      },
      coordinates: [Number]
    },
    name: {
      type: String,
      maxlength: [255, 'Should be less than 256 characters']
    },
    photos: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'Photo'
      }
    ],
    placeId: {
      type: String,
      maxlength: [255, 'Should be less than 256 characters'],
      required: [true, 'Is required']
    },
    reviews: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'Review'
      }
    ],
    steps: {
      zero: {
        type: Number,
        default: 0
      },
      one: {
        type: Number,
        default: 0
      },
      two: {
        type: Number,
        default: 0
      },
      moreThanTwo: {
        type: Number,
        default: 0
      }
    },
    types: [
      {
        type: String,
        maxlength: [50, 'Should be less than 51 characters']
      }
    ]
  },
  { timestamps: true }
);

venueSchema.index({ location: '2dsphere', placeId: 1 });

venueSchema.virtual('coordinates').get(function() {
  return {
    lat: this.location.coordinates[1],
    lng: this.location.coordinates[0]
  };
});

venueSchema.virtual('photo').get(function() {
  return undefined;
});

module.exports = {
  Venue: mongoose.model('Venue', venueSchema),
  venueSchema
};
