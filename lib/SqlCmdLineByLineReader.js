var util = require('util');
var EventEmitter = require('events');
var LineByLineReader = require('line-by-line');

var VariableExpressionRegExp = /\$\(([^\s"']+)\)/gi;
var VariableCommandRegExp = /^:setvar\s+([^\s"']+)\s+(.+)$/i;
var RunCommandRegExp = /^:r\s+(.+)$/i;

var SqlCmdLineByLineReader = (function () {
    function SqlCmdLineByLineReader(file, variables) {
        EventEmitter.call(this);

        var self = this;

        this._file = file;
        this._variables = variables;

        setImmediate(function () {
            self._init();
        });
    }

    util.inherits(SqlCmdLineByLineReader, EventEmitter);

    SqlCmdLineByLineReader.prototype._init = function () {
        var self = this;

        var reader = new LineByLineReader(this._file);

        reader.on('open', function () {
            self.emit('open');
        });

        reader.on('error', function(err) {
            self.emit('error', err);
        });

        reader.on('end', function() {
            self.emit('end');
        });

        reader.on('line', function (line) {
            line = self._stripBom(line);
            line = self._replaceVariables(line);

            var match;
            if (match = RunCommandRegExp.exec(line)) {
                var file = match[1];

                reader.pause();

                var innerReader = new SqlCmdLineByLineReader(file, self._variables);

                innerReader.on('line', function(line) {
                    self.emit('line', line);
                });

                innerReader.on('error', function(err) {
                    self.emit('error', err);
                });

                innerReader.on('end', function() {
                    reader.resume();
                });
            }
            else if (match = VariableCommandRegExp.exec(line)) {
                var variableName = match[1];
                var variableValue = match[2]; // TODO handle quoted values and escaping of quotes

                self._variables[variableName] = variableValue;
            }
            else {
                self.emit('line', line);
            }
        });
    };

    SqlCmdLineByLineReader.prototype._stripBom = function (line) {
        // it would be better to strip the bom at the begging of each file instead of trying every line
        // but that means using a different line by line reader that can be passed a stream
        if (/\ufeff/.test(line)) {
            line = line.replace(/\ufeff/g, '');
        }

        return line;
    };

    SqlCmdLineByLineReader.prototype._replaceVariables = function (line) {
        var self = this;

        return line.replace(VariableExpressionRegExp, function (match, variableName) {
            if (self._variables[variableName]) {
                return self._variables[variableName];
            }
            else {
                return match;
            }
        });
    };

    return SqlCmdLineByLineReader;
})();

module.exports = SqlCmdLineByLineReader;
