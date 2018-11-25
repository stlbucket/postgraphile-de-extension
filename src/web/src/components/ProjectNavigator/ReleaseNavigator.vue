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
import devDeployRelease from '../../gql/mutation/devDeployRelease.gql'

export default {
  name: "ReleaseNavigator",
  components: {
    MinorList
  },
  methods: {
    newMinor () {
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
    releaseStatus () {
      return this.focusRelease ? this.focusRelease.status : 'N/A'
    },
    newMinorSetDisabled () {
      return this.focusRelease.id ? this.focusRelease.locked === true : true
    }
  },
  watch: {
    selectedProjectId () {
      this.$apollo.queries.init.refetch()
    },
  },
  props: {
    focusRelease: {
      type: Object,
      required: true
    },
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
