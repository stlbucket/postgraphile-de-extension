<template>
  <div>
    <v-toolbar>
    <v-text-field
      label="Release"
      :value="focusRelease.number"
    ></v-text-field>
      <v-btn @click="explore">Explore</v-btn>
    </v-toolbar>
    <v-toolbar>
      <v-btn @click="newMinor" :disabled="newMinorSetDisabled">New Minor</v-btn>
      <v-btn @click="devDeployRelease" :disabled="newMinorSetDisabled">Redeploy</v-btn>
    </v-toolbar>
    <minor-list :focusReleaseId="focusReleaseId"></minor-list>
  </div>
</template>

<script>
import MinorList from './MinorList'
// import pdeProjectById from '../../gql/query/pdeProjectById.gql'
import devDeployRelease from '../../gql/mutation/devDeployRelease.gql'

export default {
  name: "ReleaseNavigator",
  components: {
    MinorList
  },
  methods: {
    newMinor () {
      // this.$router.push({ name: 'newMinor', params: { releaseId: this.focusReleaseId }})
      this.$router.push({ name: 'newMinor', params: { releaseId: this.focusRelease.id }})
    },
    explore () {
      this.$eventHub.$emit('exploreRelease', this.focusRelease)
    },
    devDeployRelease () {
      this.$apollo.mutate({
        mutation: devDeployRelease,
        variables: {
          releaseId: this.focusRelease.id
          // releaseId: this.focusReleaseId
        },
        fetchPolicy: 'no-cache'
      })
      .then(result => {
        this.$eventHub.$emit('devDeployCompleted')
      })
      .catch(error => {
        // alert('ERROR')
        console.log(error)
        this.$eventHub.$emit('devDeployCompleted')
      })
    }
  },
  computed: {
    focusReleaseId () {
      return this.focusRelease.id || ''
    },
    // focusRelease () {
    //   // return (this.releases.find(r => r.id === this.focusReleaseId) || {})
    //   return (this.releases.find(r => r.id === this.focusRelease.id) || {})
    // },
    releaseStatus () {
      return this.focusRelease ? this.focusRelease.status : 'N/A'
    },
    newMinorSetDisabled () {
      return this.focusRelease.id ? this.focusRelease.locked === true : true
    }
    // selectedProjectId () {
    //   return this.$store.state.focusProjectId
    // }
  },
  watch: {
    selectedProjectId () {
      this.$apollo.queries.init.refetch()
    },
    // focusRelease () {
    //   this.focusReleaseId = this.focusRelease.id || ''
    // }
  },
  // apollo: { 
  //   init: {
  //     query: pdeProjectById,
  //     variables () {
  //       return {
  //         id: this.selectedProjectId
  //       }
  //     },
  //     fetchPolicy: 'network-only',
  //     skip () {
  //       return this.selectedProjectId === ''
  //     },
  //     update (result) {
  //       this.pdeProject = result.pdeProjectById || {
  //         releases: {
  //           nodes: []
  //         }
  //       }
  //       this.releases = this.pdeProject.releases.nodes.map(
  //         release => {
  //           return Object.assign({
  //             displayName: `${release.number} - ${release.name}`
  //           }, release)
  //         }
  //       )
  //     }
  //   }
  // },
  props: {
    focusRelease: {
      type: Object,
      required: true
    },
    // pdeProjectId: {
    //   type: String,
    //   required: true
    // },
    // focusReleaseId: {
    //   type: String,
    //   required: true
    // }
  },
  data () {
    return {
      items:  [],
      selectedItems: [],
      releases: [],
      pdeProject: null
    }
  }
}
</script>
