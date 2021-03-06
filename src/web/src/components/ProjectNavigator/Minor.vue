<template>
  <div>
    <v-toolbar dark>
      <v-tooltip bottom>
        <v-icon selectable slot="activator" @click="promote" :disabled="promoteDisabled">vertical_align_top</v-icon>
        <span>promote</span>
      </v-tooltip>
      <v-tooltip bottom>
        <v-icon selectable slot="activator" @click="demote" :disabled="demoteDisabled">vertical_align_bottom</v-icon>
        <span>demote</span>
      </v-tooltip>
      <div :hidden="deferHidden">
        <v-tooltip bottom>
          <v-icon selectable slot="activator" @click="toggleDefer">{{ toggleDeferIcon }}</v-icon>
          <span>{{ toggleDeferText }}</span>
        </v-tooltip>
        <!-- <v-btn
          @click="toggleDefer"
        >{{ toggleDeferText }}</v-btn> -->
      </div>
      <div :hidden="deleteHidden">
        <v-tooltip bottom>
          <v-icon selectable slot="activator" @click="deleteMinor">clear</v-icon>
          <span>delete</span>
        </v-tooltip>
      </div>
      <v-spacer></v-spacer> 
      <v-icon :color="deploymentStatusColor">fiber_manual_record</v-icon>
      <h3>{{ `${minor.number.split('.')[1]}-${minor.name}` }}</h3>
      <v-spacer></v-spacer> 
      <v-toolbar-side-icon @click="toggleMinorHidden()"></v-toolbar-side-icon>
    </v-toolbar>
    <v-tabs
      dark
      slider-color="yellow"
      :hidden="hidden"
    >
      <v-tab
        key="Patches"
        ripple
      >
        Patches
      </v-tab>
      <v-tab-item
        key="Patches"
      >
        <minor-patch-list
          :minor="minor"
        ></minor-patch-list>
      </v-tab-item>
      <v-tab
        key="Artifacts"
        ripple
      >
        Artifacts
      </v-tab>
      <v-tab-item
        key="Artifacts"
      >
        <minor-artifact-tree
          :minor="minor"
          :allArtifactTypes="allArtifactTypes"
        ></minor-artifact-tree>
      </v-tab-item>
      <v-tab
        key="Queries"
        ripple
      >
        Queries
      </v-tab>
      <v-tab-item
        key="Queries"
      >
        <minor-query-suite
          :minor="minor"
        ></minor-query-suite>
      </v-tab-item>
      <v-tab
        key="Tests"
        ripple
      >
        Tests
      </v-tab>
      <v-tab-item
        key="Tests"
      >
        <minor-test-suite
          :minor="minor"
        ></minor-test-suite>
      </v-tab-item>
    </v-tabs>
  </div>
</template>

<script>
import MinorPatchList from './MinorPatchList'
import MinorArtifactTree from './MinorArtifactTree'
import MinorTestSuite from './MinorTestSuite'
import MinorQuerySuite from './MinorQuerySuite'
import deferMinor from '../../gql/mutation/deferMinor.gql'
import advanceMinor from '../../gql/mutation/advanceMinor.gql'
import promoteMinor from '../../gql/mutation/promoteMinor.gql'
import demoteMinor from '../../gql/mutation/demoteMinor.gql'
import deleteMinorById from '../../gql/mutation/deleteMinorById.gql'

export default {
  name: "Minor",
  components: {
    MinorPatchList,
    MinorArtifactTree,
    MinorTestSuite,
    MinorQuerySuite
  },
  methods: {
    toggleMinorHidden (minorId) {
      this.hidden = !this.hidden
    },
    toggleDefer() {
      console.log('this.minor', this.minor)
      this.$apollo.mutate({
        mutation: this.toggleDeferMutation,
        variables: {
          minorId:  this.minor.id
        }
      })
      .then(result => {
        console.log('result', result)
        this.$eventHub.$emit('minorDeferredToggled', this.minor)
      })
      .catch(error => {
        alert('ERROR')
        console.log('error', error)
      })
    },
    deleteMinor () {
      this.$apollo.mutate({
        mutation: deleteMinorById,
        variables: {
          id: this.minor.id
        }
      })
      .then(result => {
        this.$eventHub.$emit('minorDeleted')
      })
      .catch(error => {
        alert('ERROR')
        console.log(error)
      })
    },
    promote() {
      this.$apollo.mutate({
        mutation: promoteMinor,
        variables: {
          minorId:  this.minor.id
        }
      })
      .then(result => {
        console.log('result', result)
        this.$eventHub.$emit('minorPromoted', this.minor)
      })
      .catch(error => {
        alert('ERROR')
        console.log('error', error)
      })

    },
    demote() {
      this.$apollo.mutate({
        mutation: demoteMinor,
        variables: {
          minorId:  this.minor.id
        }
      })
      .then(result => {
        console.log('result', result)
        this.$eventHub.$emit('minorDemoted', this.minor)
      })
      .catch(error => {
        alert('ERROR')
        console.log('error', error)
      })

    }
  },
  computed: {
    promoteDisabled () {

    },
    demoteDisabled () {

    },
    deleteHidden () {
      return this.minor.patches.nodes.length > 0
    },
    deferHidden () {
      return this.minor.patches.nodes.length === 0
    },
    toggleDeferIcon () {
      switch (this.minor.release.status) {
        case 'DEVELOPMENT':
          return 'call_received'
        break;
        case 'FUTURE':
          return 'call_made'
        break;
        default:
          return ''
      }
    },
    toggleDeferText () {
      switch (this.minor.release.status) {
        case 'DEVELOPMENT':
          this.toggleDeferMutation = deferMinor
          return 'Defer'
        break;
        case 'FUTURE':
          this.toggleDeferMutation = advanceMinor
          return 'Advance'
        break;
        default:
          return ''
      }
    },
    deploymentStatusColor () {
      const errorPatch = this.minor.patches.nodes.find(p => (p.devDeployment || {}).status === 'ERROR')
      const undeployedPatch = this.minor.patches.nodes.find(p => p.devDeployment === null || p.devDeployment === undefined)
      if (errorPatch) return 'red'
      if (undeployedPatch) return 'yellow'
      return 'green'
    }
  },
  props: {
    minor: {
      type: Object,
      required: true
    },
    allArtifactTypes: {
      type: Array,
      default: () => []
    }
  },
  data () {
    return {
      items:  [],
      selectedItems: [],
      panel: [],
      expand: true,
      hidden: this.minor.patches.nodes.length > 0
    }
  },
}
</script>
