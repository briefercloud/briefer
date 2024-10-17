{{- define "chart.secret.jupyterToken" -}}
{{- $root := . -}}
{{- $secretVal := index $root.Values.api.secrets "jupyterToken" -}}
{{- if $secretVal }}
  {{- $secretVal -}}
{{- else }}
  {{- $rand := randAlphaNum 32 | b64enc | sha256sum -}}
  {{- $rand -}}
{{- end }}
{{- end -}}

{{- define "chart.secret.loginJwtSecret" -}}
{{- $root := . -}}
{{- $secretVal := index $root.Values.api.secrets "loginJwtSecret" -}}
{{- if $secretVal }}
  {{- $secretVal -}}
{{- else }}
  {{- $rand := randAlphaNum 32 | b64enc | sha256sum -}}
  {{- $rand -}}
{{- end }}
{{- end -}}

{{- define "chart.secret.authJwtSecret" -}}
{{- $root := . -}}
{{- $secretVal := index $root.Values.api.secrets "authJwtSecret" -}}
{{- if $secretVal }}
  {{- $secretVal -}}
{{- else }}
  {{- $rand := randAlphaNum 32 | b64enc | sha256sum -}}
  {{- $rand -}}
{{- end }}
{{- end -}}

{{- define "chart.secret.datasourcesEncryptionKey" }}
{{- $root := . -}}
{{- $secretVal := index $root.Values.api.secrets "datasourcesEncryptionKey" -}}
{{- if $secretVal }}
  {{- $secretVal -}}
{{- else }}
  {{- $rand := randAlphaNum 32 | b64enc | sha256sum -}}
  {{- $rand -}}
{{- end }}
{{- end -}}

{{- define "chart.secret.environmentVariablesEncryptionKey" }}
{{- $root := . -}}
{{- $secretVal := index $root.Values.api.secrets "environmentVariablesEncryptionKey" -}}
{{- if $secretVal }}
  {{- $secretVal -}}
{{- else }}
  {{- $rand := randAlphaNum 32 | b64enc | sha256sum -}}
  {{- $rand -}}
{{- end }}
{{- end -}}

{{- define "chart.secret.integrationsConfigEncryptionKey" }}
{{- $root := . -}}
{{- $secretVal := index $root.Values.api.secrets "integrationsConfigEncryptionKey" -}}
{{- if $secretVal }}
  {{- $secretVal -}}
{{- else }}
  {{- $rand := randAlphaNum 32 | b64enc | sha256sum -}}
  {{- $rand -}}
{{- end }}
{{- end -}}

{{- define "chart.secret.workspaceSecretsEncryptionKey" }}
{{- $root := . -}}
{{- $secretVal := index $root.Values.api.secrets "workspaceSecretsEncryptionKey" -}}
{{- if $secretVal }}
  {{- $secretVal -}}
{{- else }}
  {{- $rand := randAlphaNum 32 | b64enc | sha256sum -}}
  {{- $rand -}}
{{- end }}
{{- end -}}
