/*
 * This file is intended for vendors to implement
 * code needed to integrate testharness.js tests with their own test systems.
 *
 * The default implementation extracts metadata from the tests and validates 
 * it against the cached version that should be present in the test source file.
 * If the cache is not found or out of sync, source code suitable for caching the 
 * metadata is optionally generated.
 *
 * The cached metadata is present for extraction by test processing tools that
 * are unable to execute javascript.
 *
 * Typically test system integration will attach callbacks when each test has
 * run, using add_result_callback(callback(test)), or when the whole test file has
 * completed, using add_completion_callback(callback(tests, harness_status)).
 *
 * For more documentation about the callback functions and the
 * parameters they are called with see testharness.js
 */



var metadata_generator = {

  metadata: {},
  metadataProperties: ['help', 'assert', 'author'],
  
  error: function(message) {
    var messageElement = document.createElement('p');
    messageElement.setAttribute('class', 'error');
    this.appendText(messageElement, message);
    
    var summary = document.getElementById('summary');
    if (summary) {
      summary.parentNode.insertBefore(messageElement, summary);
    }
    else {
      document.body.appendChild(messageElement);
    }
  },
  
  /**
   * Extract metadata from test object
   */
  extractFromTest: function(test) {
    var testMetadata = {};
    // filter out metadata from other properties in test
    for (var metaIndex = 0; metaIndex < this.metadataProperties.length; metaIndex++) {
      var meta = this.metadataProperties[metaIndex];
      if (test.properties.hasOwnProperty(meta)) {
        testMetadata[meta] = test.properties[meta];
      }
    }
    return testMetadata;
  },
  
  /**
   * Compare cached metadata to extracted metadata
   */
  validateCache: function() {
    for (var testName in this.metadata) {
      if (! cached_metadata.hasOwnProperty(testName)) {
        return false;
      }
      var testMetadata = this.metadata[testName];
      var cachedTestMetadata = cached_metadata[testName];
      delete cached_metadata[testName];
      
      for (var metaIndex = 0; metaIndex < this.metadataProperties.length; metaIndex++) {
        var meta = this.metadataProperties[metaIndex];
        if (cachedTestMetadata.hasOwnProperty(meta) && testMetadata.hasOwnProperty(meta)) {
          if (! cachedTestMetadata[meta] instanceof Array) {
            return false;
          }
          if (cachedTestMetadata[meta].length == testMetadata[meta].length) {
            for (var index = 0; index < cachedTestMetadata[meta].length; index++) {
              if (cachedTestMetadata[meta][index] != testMetadata[meta][index]) {
                return false;
              }
            }
          }
          else {
            return false
          }
        }
        else if (cachedTestMetadata.hasOwnProperty(meta) || testMetadata.hasOwnProperty(meta)) {
          return false;
        }
      }
    }
    for (var testName in cached_metadata) {
      return false;
    }
    return true;
  },
  
  appendText: function(elemement, text) {
    elemement.appendChild(document.createTextNode(text));
  },
  
  jsonifyArray: function(arrayValue, indent) {
    var output = '[';

    if (1 == arrayValue.length) {
      output += JSON.stringify(arrayValue[0]);
    }
    else {
      for (var index = 0; index < arrayValue.length; index++) {
        if (0 < index) {
          output += ',\n  ' + indent;
        }
        output += JSON.stringify(arrayValue[index]);
      }
    }
    output += ']';
    return output;
  },
  
  jsonifyObject: function(objectValue, indent) {
    var output = '{';
    
    var first = true;
    for (var property in objectValue) {
      if (! first) {
        output += ',';
      }
      first = false;
      output += '\n  ' + indent + '"' + property + '": ';
      var value = objectValue[property];
      if (value instanceof Array) {
        output += this.jsonifyArray(value, indent + '                '.substr(0, 5 + property.length));
      }
      else if ('object' == typeof(value)) {
        output += this.jsonifyObject(value, indent + '  ');
      }
      else {
        output += JSON.stringify(value);
      }
    }
    if (1 < output.length) {
      output += '\n' + indent;
    }
    output += '}';
    return output;
  },
  
  /**
   * Generate javascript source code for captured metadata
   * Metadata is in pretty-printed JSON format
   */
  generateSource: function() {
    var source = 
      '<script id="test_metadata">\n' + 
      'var cached_metadata = ' + this.jsonifyObject(this.metadata, '') + '\n' + 
      '</script>\n';
    return source;
  },
  
  /**
   * Add element containing metadata source code
   */
  addSourceElement: function() {
    var sourceWrapper = document.createElement('div');
    sourceWrapper.setAttribute('id', 'metadata_source');

    var instructions = document.createElement('p');
    this.appendText(instructions, "Copy the following into the <head> element of the test or the test's metadata sidecar file:");
    sourceWrapper.appendChild(instructions);
    
    var sourceElement = document.createElement('pre');
    this.appendText(sourceElement, this.generateSource());

    sourceWrapper.appendChild(sourceElement);
    
    var messageElement = document.getElementById('metadata_issue');
    messageElement.parentNode.insertBefore(sourceWrapper, messageElement.nextSibling);
    messageElement.parentNode.removeChild(messageElement);
  },
  
  /**
   * Main entry point, extract metadata from tests, compare to cached version if present
   * If cache not present or differs from extrated metadata, generate an error
   */
  process: function(tests, harness_status) {
    for (var index = 0; index < tests.length; index++) {
      var test = tests[index];
      if (this.metadata[test.name]) {
        this.error('Duplicate test name: ' + test.name);
      }
      else {
        this.metadata[test.name] = this.extractFromTest(test);
      }
    }

    var message = null;
    var messageClass = 'warning';
    if (window.cached_metadata != undefined) {
      if (! this.validateCache()) {
        message = 'Cached metadata out of sync. ';
        messageClass = 'error';
      }
    }
    else {
      message = 'Cached metdata not present. ';
    }
    
    if (message) {
      var messageElement = document.createElement('p');
      messageElement.setAttribute('id', 'metadata_issue');
      messageElement.setAttribute('class', messageClass);
      this.appendText(messageElement, message);
      
      var link = document.createElement('a');
      this.appendText(link, 'Click for source code.');
      link.setAttribute('href', '#');
      link.setAttribute('onclick', 'metadata_generator.addSourceElement()');
      messageElement.appendChild(link);
      
      var summary = document.getElementById('summary');
      if (summary) {
        summary.parentNode.insertBefore(messageElement, summary);
      }
      else {
        document.body.appendChild(messageElement);
      }
    }
  },

  setup: function() {
    add_completion_callback(function (tests, harness_status) { 
                              metadata_generator.process(tests, harness_status)
                            });
  }
}

metadata_generator.setup();

