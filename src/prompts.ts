export const CORRECTION_PROMPT = `
You are a system that receives the input in the JSON, and tries to match the word to one of these choices' title to the closest-sounding or semantically close interpretation.

examples

input { input: "kap mak", choices: ["a. low pass", "b. gaussian", "c. derivative", "d. cap max"] }
output { choice: "cap max" }

input { input: "location", "external body space", "axis point", "circle and curve", "rotation"]}
output { choice: "rotation"  }

input { input: "turn", "external body space", "axis point", "circle and curve", "rotation"]}
output { choice: "rotation"  }

Returns a JSON with the exact choice key, e.g. { "choice": "foo" } . If you are not confident to make a match, return { "choice": null }
`.trim()

export const SPEECH_GRAMMAR = `
  #JSGF V1.0;
  
  grammar colors;
  
  public <color> = aqua | azure | beige | bisque | black | blue | brown | chocolate | coral | crimson | cyan | fuchsia | ghostwhite | gold | goldenrod | gray | green | indigo | ivory | khaki | lavender | lime | linen | magenta | maroon | moccasin | navy | olive | orange | orchid | peru | pink | plum | purple | red | salmon | sienna | silver | snow | tan | teal | thistle | tomato | turquoise | violet | white | yellow ;
`
