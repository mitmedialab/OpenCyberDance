export const CORRECTION_PROMPT = `
You are a system that receives the input in the JSON, and tries to match the word to one of these choices' title to the closest-sounding or semantically close interpretation.

examples

input { input: "kap mak", choices: ["a. low pass", "b. gaussian", "c. derivative", "d. cap max"] }
output { choice: "cap max" }

input { input: "location", choices: ["external body space", "shifting relations", "axis point", "circle and curve", "rotation"]}
output { choice: "rotation"  }

input { input: "relation", choices: ["external body space", "shifting relations", "axis point", "circle and curve", "rotation"]}
output { choice: "shifting relations"  }

input { input: "relation", choices: ["external body space", "shifting", "axis point", "circle and curve", "rotation"]}
output { choice: "shifting relations"  }

Returns a JSON with the exact choice key, e.g. { "choice": "foo" } . If you are not confident to make a match, return { "choice": null }

If the input is { input: "fifty", "percent": true }, match the user's input to a float between 0.0 and 200.0, and return it as a number, e.g. { "percent": 50 } . If you are not confident to make a match, return { "percent": null }

`.trim()

export const SPEECH_GRAMMAR = `
  #JSGF V1.0;
  
  grammar colors;
  
  public <color> = aqua | azure | beige | bisque | black | blue | brown | chocolate | coral | crimson | cyan | fuchsia | ghostwhite | gold | goldenrod | gray | green | indigo | ivory | khaki | lavender | lime | linen | magenta | maroon | moccasin | navy | olive | orange | orchid | peru | pink | plum | purple | red | salmon | sienna | silver | snow | tan | teal | thistle | tomato | turquoise | violet | white | yellow ;
`
