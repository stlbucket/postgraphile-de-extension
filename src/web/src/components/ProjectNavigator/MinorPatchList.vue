<template>
  <div>
    <v-btn
      @click="newPatch"
      :disabled="newPatchDisabled"
    >New Patch</v-btn>
    <v-container
        id="scroll-target"
        style="max-height: 256px"
        class="scroll-y"
      >
      <v-list>
        <template v-for="(patch, index) in minor.patches.nodes">
          <v-list-tile
            v-scroll:#scroll-target="onScroll"
            :key="patch.id"
            ripple
            @click="selected(patch)"
            :class="getCssClass(patch)"
          >
            <v-list-tile-content>
              <v-list-tile-sub-title class="text--primary">
                <v-icon small @click="promotePatch(patch)" :disabled="promoteDisabled(patch)">vertical_align_top</v-icon>
                <v-icon small @click="demotePatch(patch)" :disabled="demoteDisabled(patch)">vertical_align_bottom</v-icon>
                <v-icon :color="patchStatusColor(patch)" small>fiber_manual_record</v-icon>
                {{ `${patch.number.split('.')[2]} - ${patch.patchType.name} - ${patch.artifact.name}` }}
              </v-list-tile-sub-title>
            </v-list-tile-content>

          </v-list-tile>
          <v-divider
            v-if="index + 1 < items.length"
            :key="index"
          ></v-divider>
        </template>
      </v-list>        
    </v-container>
  </div>
</template>

<script>
import promotePatch from '../../gql/mutation/promotePatch.gql'
import demotePatch from '../../gql/mutation/demotePatch.gql'

export default {
  name: "MinorPatchList",
  computed: {
    newPatchDisabled () {
      return this.minor.locked
    },
    focusPatchId () {
      return this.$store.state.focusPatchId
    }
  },
  methods: {
    promotePatch (patch) {
      this.$apollo.mutate({
        mutation: promotePatch,
        variables: {
          patchId: patch.id
        }
      })
      .then(result => {
        this.$eventHub.$emit('patchPromoted')
      })
      .catch(error => {
        alert('ERROR')
        console.log(error)
      })
    },
    demotePatch (patch) {
      this.$apollo.mutate({
        mutation: demotePatch,
        variables: {
          patchId: patch.id
        }
      })
      .then(result => {
        this.$eventHub.$emit('patchDemoted')
      })
      .catch(error => {
        alert('ERROR')
        console.log(error)
      })
    },
    selected (patch) {
      this.$store.commit('focusPatchId', { focusPatchId: patch.id })
    },
    newPatch () {
      this.$eventHub.$emit('newPatch', this.minor)
    },
    getCssClass(patch) {
      return (patch.id === this.focusPatchId) ? 'v-list__tile--active' : 'v-list__tile'
    },
    patchStatusColor(patch) {
      return patch.devDeployment ? (patch.devDeployment.status === 'DEPLOYED' ? 'green' : 'red') : 'yellow'
    },
    promoteDisabled(patch) {
      return patch.revision === 0
    },
    demoteDisabled(patch) {
      return patch.revision === this.minor.patches.nodes.reduce(
        (acc, patch) => {
          return patch.revision > acc ? patch.revision : acc
        }, 0
      )
    }
  },
  watch: {
    minor: {
      handler (val) {
        this.$forceUpdate()
      },
      deep: true
    } 
  },
  props: {
    minor: {
      type: Object,
      required: true
    }
  },
  data () {
    return {
      items:  [],
      selectedItems: [],
      panel: [],
      expand: true,
      pdeProject: null,
      focusPatch: {
        artifact: {}
      }
    }
  }
}
</script>
