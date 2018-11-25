<template>
  <div>
    <v-toolbar>
      <v-tooltip bottom>
        <v-icon 
          selectable 
          @click="config"
          slot="activator"
        >build</v-icon>
        <span>config</span>
      </v-tooltip>
      <v-spacer></v-spacer>
      <v-tooltip bottom>
        <v-icon 
          @click="importProject"
          slot="activator"
        >trending_up</v-icon>
        <span>import project</span>
      </v-tooltip>
      <v-spacer></v-spacer>
      <v-tooltip bottom>
        <v-icon 
          @click="newProject"
          slot="activator"
        >add_circle</v-icon>
        <span>new project</span>
      </v-tooltip>
      <v-spacer></v-spacer>
      <v-tooltip bottom>
        <v-icon 
          @click="exportProject"
          slot="activator"
        >trending_down</v-icon>
        <span>export project</span>
      </v-tooltip>
      <v-spacer></v-spacer>
      <v-tooltip bottom>
        <v-icon 
          @click="manageProject"
          slot="activator"
        >local_library</v-icon>
        <span>manage project</span>
      </v-tooltip>
      <v-spacer></v-spacer>
      <v-tooltip bottom>
        <v-icon 
          selectable 
          @click="graphQLSchema"
          slot="activator"
        >border_clear</v-icon>
        <span>graph view</span>
      </v-tooltip>
      <v-spacer></v-spacer>
      <v-tooltip bottom>
        <v-icon 
          selectable
          @click="newPsqlQuery"
          slot="activator"
        >call_to_action</v-icon>
        <span>psql</span>
      </v-tooltip>
      <v-spacer></v-spacer>
      <v-tooltip bottom>
        <v-icon 
          selectable 
          @click="graphiql"
          slot="activator"
        >featured_video</v-icon>
        <span>graphiql</span>
      </v-tooltip>
    </v-toolbar>
    <release-navigator 
      :focusRelease="focusRelease"
    ></release-navigator>
  </div>
</template>

<script>
import ReleaseNavigator from './ReleaseNavigator'
import pdeProjectById from '../../gql/query/pdeProjectById.gql'
const SELECTED_PROJECT_ID = 'selectedProjectId'

export default {
  name: "ProjectNavigator",
  components: {
    ReleaseNavigator
  },
  computed: {
    selectedProjectId () {
      return this.$store.state.focusProjectId
    },
    focusSchemaId () {
      return this.$store.state.focusSchemaId
    },
    focusArtifactTypeId () {
      return this.$store.state.focusArtifactTypeId
    },
    focusArtifactId () {
      return this.$store.state.focusArtifactId
    },
    focusPatchId () {
      return this.$store.state.focusPatchId
    },
    focusArtifactTypeId () {
      return this.$store.state.focusArtifactTypeId
    }
  },
  watch: {  // todo - convert as many watchers as possible
    selectedProjectId: {
      handler: 'manageProject',
      immediate: true
    },
    focusSchemaId: {
      handler: 'schemaDetail',
      immediate: true
    },
    focusArtifactId: {
      handler: 'artifactDetail',
      immediate: true
    },
    focusArtifactTypeId: {
      handler: 'artifactTypeDetail',
      immediate: true
    },
    focusPatchId: {
      handler: 'patchDetail',
      immediate: true
    }
  },
  methods: {  // todo: get rid of as many events as possible
    config () {
      this.$router.push({ name: 'config' })
    },
    schemaDetail () {
      if (this.focusSchemaId !== '') {
        this.$router.push({ name: 'schemaDetail', params: { id: this.focusSchemaId }})
      }
    },
    artifactDetail () {
      if (this.focusArtifactId !== '') {
        this.$router.push({ name: 'artifactDetail', params: { id: this.focusArtifactId }})
      }
    },
    artifactTypeDetail () {
      if (this.focusArtifactTypeId !== '') {
        this.$router.push({ name: 'artifactTypeDetail', params: { id: this.focusArtifactTypeId }})
      }
    },
    patchDetail () {
      if (this.focusPatchId !== '') {
        this.$router.push({ name: 'patchDetail', params: { id: this.focusPatchId }})
      }
    },
    newProject () {
      this.$router.push({ name: 'newProject' })
    },
    projectCreated (project) {
      console.log('pc', project)
      const devRelease = project.releases.nodes.find(r => r.status === 'DEVELOPMENT')
      console.log('devRelease', devRelease)
      this.manageProject()
    },
    exportProject () {
      this.$router.push({ name: 'exportProject'})
    },
    importProject () {
      this.$router.push({ name: 'importProject'})
    },
    manageProject () {
      this.$router.push({ name: 'projectDetail'})
    },
    graphQLSchema () {
      this.$router.push({ name: 'graphQLSchema' })
    },
    graphiql () {
      this.$router.push({ name: 'graphileiql' })
    },
    newPsqlQuery () {
        this.$router.push({ name: 'new-psql-query' })
    },
    newGraphQLQuery () {
      this.$router.push({ name: 'graphileiql' })
    },
    schemaSelected (schema) {
      this.$eventHub.$emit('focusPatch', schema)
    },
    newSchema (release) {
      this.$router.push({ name: 'newSchema', params: { releaseId: release.id }})
    },
    newMinorCreated (minor) {
      this.$router.push({ name: 'releaseDetail', params: { id: minor.releaseId }})
    },
    newPatch (minor) {
      this.$router.push({ name: 'newPatch', params: { minorId: minor.id }})
    },
    patchCreated (patch) {
      this.$router.push({ name: 'artifact', params: { id: patch.artifactId }})
    },
    newPgTapTest () {
      this.$router.push({ name: 'pg-tap-test', params: { id: 'N/A' }})
    },
    newGraphQLTest () {
      this.$router.push({ name: 'graph-ql-test', params: { id: 'N/A' }})
    },
    gqlTestSelected (test) {
      this.$router.push({ name: 'test-graph-ql', params: { id: test.id }})
    },
    exploreRelease (release) {
      console.log('FOCUS THIS', release)
      this.focusRelease = release
      this.$router.push({ name: 'releaseDetail', params: { id: release.id }})
    },
    newDevelopmentRelease () {
      this.$router.push({ name: 'newDevelopmentRelease'})
    }
  },
  data () {
    return {
      projects: [],
      pdeProjectId: '',
      focusRelease: {},
      pdeProject: null
    }
  },
  apollo: { 
    init: {
      query: pdeProjectById,
      variables () {
        return {
          id: this.selectedProjectId
        }
      },
      fetchPolicy: 'network-only',
      skip () {
        return this.selectedProjectId === ''
      },
      update (result) {
        this.pdeProject = result.pdeProjectById || {
          releases: {
            nodes: []
          }
        }
        this.releases = this.pdeProject.releases.nodes.map(
          release => {
            return Object.assign({
              displayName: `${release.number} - ${release.name}`
            }, release)
          }
        )

        this.focusRelease = this.releases.find(r => r.status === 'DEVELOPMENT')
      }
    }
  },
  created () {
    this.$eventHub.$on('newPatch', this.newPatch)  
    this.$eventHub.$on('patchCreated', this.patchCreated)  
    this.$eventHub.$on('newSchema', this.newSchema)  
    this.$eventHub.$on('exploreRelease', this.exploreRelease)  
    this.$eventHub.$on('newDevelopmentRelease', this.newDevelopmentRelease)  
    this.$eventHub.$on('newGraphQLQuery', this.newGraphQLQuery)  
    this.$eventHub.$on('newPgTapTest', this.newPgTapTest)  
    this.$eventHub.$on('newGraphQLTest', this.newGraphQLTest)
    this.$eventHub.$on('newDevelopmentReleaseCreated', this.exploreRelease)
    this.$eventHub.$on('newMinorCreated', this.newMinorCreated)
    this.$eventHub.$on('projectCreated', this.projectCreated)
  },
  beforeDestroy() {
    this.$eventHub.$off('newPatch')
    this.$eventHub.$off('patchCreated')
    this.$eventHub.$off('newSchema')
    this.$eventHub.$off('exploreRelease')
    this.$eventHub.$off('newDevelopmentRelease')
    this.$eventHub.$off('newGraphQLQuery')
    this.$eventHub.$off('newPgTapTest')
    this.$eventHub.$off('newGraphQLTest')
    this.$eventHub.$off('newDevelopmentReleaseCreated')
    this.$eventHub.$off('newMinorCreated')
    this.$eventHub.$off('projectCreated')
  }
}
</script>
